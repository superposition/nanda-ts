/**
 * A2A JSON-RPC Handler
 *
 * Handles incoming A2A protocol requests
 */

import type {
  JsonRpcRequest,
  JsonRpcResponse,
  Task,
  TaskState,
  Message,
  TasksGetParams,
  TasksListParams,
  TasksCancelParams,
  TasksListResponse,
} from '../types';
import { JsonRpcErrorCode } from '../types';
import { createSSEResponse } from '../protocols/a2a/streaming';

/**
 * Method handler function type
 */
export type MethodHandler<TParams = unknown, TResult = unknown> = (
  params: TParams,
  context: RequestContext
) => Promise<TResult>;

/**
 * Request context provided to handlers
 */
export interface RequestContext {
  requestId: string | number;
  clientIp?: string;
  headers: Headers;
  emit?: (data: unknown) => Promise<void>;
}

/**
 * A2A Handler configuration
 */
export interface A2AHandlerConfig {
  validateAuth?: boolean;
  onError?: (error: Error, context: RequestContext) => void;
}

/**
 * A2A JSON-RPC Handler
 */
export class A2AHandler {
  private handlers: Map<string, MethodHandler> = new Map();
  private taskStore: Map<string, Task> = new Map();
  private config: A2AHandlerConfig;

  constructor(config: A2AHandlerConfig = {}) {
    this.config = config;
  }

  /**
   * Register a method handler
   */
  register<TParams = unknown, TResult = unknown>(
    method: string,
    handler: MethodHandler<TParams, TResult>
  ): void {
    this.handlers.set(method, handler as MethodHandler);
  }

  /**
   * Unregister a method handler
   */
  unregister(method: string): void {
    this.handlers.delete(method);
  }

  /**
   * Handle an HTTP request
   */
  async handle(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const response = await this.processRequest(body as JsonRpcRequest, request);
      return Response.json(response);
    } catch (error) {
      return Response.json({
        jsonrpc: '2.0',
        error: {
          code: JsonRpcErrorCode.PARSE_ERROR,
          message: 'Invalid JSON',
        },
        id: null,
      } satisfies JsonRpcResponse);
    }
  }

  /**
   * Handle a streaming request
   */
  async handleStream(request: Request): Promise<Response> {
    let body: JsonRpcRequest;
    try {
      body = (await request.json()) as JsonRpcRequest;
    } catch {
      return Response.json({
        jsonrpc: '2.0',
        error: {
          code: JsonRpcErrorCode.PARSE_ERROR,
          message: 'Invalid JSON',
        },
        id: null,
      } satisfies JsonRpcResponse);
    }

    const { response, send, close } = createSSEResponse();

    // Process in background
    (async () => {
      try {
        const handler = this.handlers.get(body.method);
        if (!handler) {
          await send(
            JSON.stringify({
              error: {
                code: JsonRpcErrorCode.METHOD_NOT_FOUND,
                message: `Method not found: ${body.method}`,
              },
            })
          );
          close();
          return;
        }

        const context: RequestContext = {
          requestId: body.id,
          clientIp: request.headers.get('x-forwarded-for') ?? undefined,
          headers: request.headers,
          emit: async (data) => {
            await send(JSON.stringify(data));
          },
        };

        const result = await handler(body.params, context);
        await send(JSON.stringify({ result, done: true }));
        await send('[DONE]');
      } catch (error) {
        await send(
          JSON.stringify({
            error: {
              code: JsonRpcErrorCode.INTERNAL_ERROR,
              message: error instanceof Error ? error.message : 'Internal error',
            },
          })
        );
      } finally {
        close();
      }
    })();

    return response;
  }

  /**
   * Process a JSON-RPC request
   */
  private async processRequest(
    request: JsonRpcRequest,
    httpRequest: Request
  ): Promise<JsonRpcResponse> {
    // Validate JSON-RPC format
    if (
      request.jsonrpc !== '2.0' ||
      !request.method ||
      request.id === undefined
    ) {
      return {
        jsonrpc: '2.0',
        error: {
          code: JsonRpcErrorCode.INVALID_REQUEST,
          message: 'Invalid JSON-RPC request',
        },
        id: request.id ?? null,
      };
    }

    // Built-in task management methods
    if (request.method === 'tasks/get') {
      return this.handleTasksGet(request);
    }
    if (request.method === 'tasks/list') {
      return this.handleTasksList(request);
    }
    if (request.method === 'tasks/cancel') {
      return this.handleTasksCancel(request);
    }

    // Custom handler
    const handler = this.handlers.get(request.method);
    if (!handler) {
      return {
        jsonrpc: '2.0',
        error: {
          code: JsonRpcErrorCode.METHOD_NOT_FOUND,
          message: `Method not found: ${request.method}`,
        },
        id: request.id,
      };
    }

    try {
      const context: RequestContext = {
        requestId: request.id,
        clientIp: httpRequest.headers.get('x-forwarded-for') ?? undefined,
        headers: httpRequest.headers,
      };

      const result = await handler(request.params, context);
      return {
        jsonrpc: '2.0',
        result,
        id: request.id,
      };
    } catch (error) {
      const errorResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        error: {
          code: JsonRpcErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Internal error',
          data:
            error instanceof Error && process.env.NODE_ENV !== 'production'
              ? error.stack
              : undefined,
        },
        id: request.id,
      };

      if (this.config.onError && error instanceof Error) {
        this.config.onError(error, {
          requestId: request.id,
          headers: httpRequest.headers,
        });
      }

      return errorResponse;
    }
  }

  /**
   * Store a task
   */
  storeTask(task: Task): void {
    this.taskStore.set(task.id, task);
  }

  /**
   * Get a stored task
   */
  getStoredTask(taskId: string): Task | undefined {
    return this.taskStore.get(taskId);
  }

  /**
   * Update a task's state
   */
  updateTaskState(taskId: string, state: TaskState): Task | undefined {
    const task = this.taskStore.get(taskId);
    if (task) {
      task.state = state;
      task.updatedAt = new Date().toISOString();
      this.taskStore.set(taskId, task);
    }
    return task;
  }

  /**
   * Create a new task
   */
  createTask(message: Message, contextId?: string): Task {
    const task: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      contextId: contextId ?? `ctx-${Date.now()}`,
      state: 'SUBMITTED',
      message,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.storeTask(task);
    return task;
  }

  /**
   * Handle tasks/get method
   */
  private handleTasksGet(request: JsonRpcRequest): JsonRpcResponse {
    const params = request.params as TasksGetParams | undefined;
    if (!params?.taskId) {
      return {
        jsonrpc: '2.0',
        error: {
          code: JsonRpcErrorCode.INVALID_PARAMS,
          message: 'Missing taskId parameter',
        },
        id: request.id,
      };
    }

    const task = this.taskStore.get(params.taskId);
    if (!task) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32003, // TASK_NOT_FOUND
          message: `Task not found: ${params.taskId}`,
        },
        id: request.id,
      };
    }

    return {
      jsonrpc: '2.0',
      result: task,
      id: request.id,
    };
  }

  /**
   * Handle tasks/list method
   */
  private handleTasksList(request: JsonRpcRequest): JsonRpcResponse {
    const params = request.params as TasksListParams | undefined;
    const limit = params?.limit ?? 100;
    const offset = params?.offset ?? 0;

    let tasks = Array.from(this.taskStore.values());

    // Filter by contextId if provided
    if (params?.contextId) {
      tasks = tasks.filter((task) => task.contextId === params.contextId);
    }

    // Sort by creation date (newest first)
    tasks.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = tasks.length;
    const paginatedTasks = tasks.slice(offset, offset + limit);

    const result: TasksListResponse = {
      tasks: paginatedTasks,
      total,
      hasMore: offset + limit < total,
    };

    return {
      jsonrpc: '2.0',
      result,
      id: request.id,
    };
  }

  /**
   * Handle tasks/cancel method
   */
  private handleTasksCancel(request: JsonRpcRequest): JsonRpcResponse {
    const params = request.params as TasksCancelParams | undefined;
    if (!params?.taskId) {
      return {
        jsonrpc: '2.0',
        error: {
          code: JsonRpcErrorCode.INVALID_PARAMS,
          message: 'Missing taskId parameter',
        },
        id: request.id,
      };
    }

    const task = this.updateTaskState(params.taskId, 'CANCELLED');
    if (!task) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32003, // TASK_NOT_FOUND
          message: `Task not found: ${params.taskId}`,
        },
        id: request.id,
      };
    }

    return {
      jsonrpc: '2.0',
      result: task,
      id: request.id,
    };
  }
}
