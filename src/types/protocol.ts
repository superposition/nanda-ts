/**
 * JSON-RPC 2.0 and A2A protocol types
 */

/**
 * JSON-RPC 2.0 request structure
 */
export interface JsonRpcRequest<TParams = unknown> {
  jsonrpc: '2.0';
  method: string;
  params?: TParams;
  id: string | number;
}

/**
 * JSON-RPC 2.0 response structure
 */
export interface JsonRpcResponse<TResult = unknown> {
  jsonrpc: '2.0';
  result?: TResult;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number | null;
}

/**
 * Authenticated JSON-RPC request (A2A extension)
 */
export interface AuthenticatedJsonRpcRequest<TParams = unknown>
  extends JsonRpcRequest<TParams> {
  auth?: {
    from: string; // DID of the sender
    signature: string; // Signature over the request
  };
}

/**
 * A2A Task states
 */
export type TaskState =
  | 'SUBMITTED'
  | 'WORKING'
  | 'INPUT_REQUIRED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'AUTH_REQUIRED';

/**
 * Message role
 */
export type MessageRole = 'user' | 'agent';

/**
 * Input/Output modes
 */
export type ContentMode = 'text' | 'file' | 'audio' | 'video' | 'image' | 'data';

/**
 * Text part of a message
 */
export interface TextPart {
  type: 'text';
  text: string;
}

/**
 * File content structure
 */
export interface FileContent {
  name?: string;
  mimeType?: string;
  bytes?: string; // base64 encoded
  uri?: string;
}

/**
 * File part of a message
 */
export interface FilePart {
  type: 'file';
  file: FileContent;
}

/**
 * Data part of a message
 */
export interface DataPart {
  type: 'data';
  data: Record<string, unknown>;
}

/**
 * Union type for message parts
 */
export type Part = TextPart | FilePart | DataPart;

/**
 * A2A Message structure
 */
export interface Message {
  role: MessageRole;
  parts: Part[];
  metadata?: Record<string, unknown>;
}

/**
 * A2A Artifact structure
 */
export interface Artifact {
  id: string;
  name?: string;
  description?: string;
  parts: Part[];
}

/**
 * A2A Task structure
 */
export interface Task {
  id: string;
  contextId: string;
  state: TaskState;
  message: Message;
  artifacts?: Artifact[];
  history?: Message[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Task configuration options
 */
export interface TaskConfiguration {
  timeout?: number;
  streaming?: boolean;
  acceptedOutputModes?: ContentMode[];
  historyLength?: number;
}

/**
 * Parameters for message/send method
 */
export interface MessageSendParams {
  message: Message;
  contextId?: string;
  configuration?: TaskConfiguration;
}

/**
 * Parameters for tasks/get method
 */
export interface TasksGetParams {
  taskId: string;
}

/**
 * Parameters for tasks/list method
 */
export interface TasksListParams {
  contextId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Parameters for tasks/cancel method
 */
export interface TasksCancelParams {
  taskId: string;
}

/**
 * Parameters for tasks/subscribe method
 */
export interface TasksSubscribeParams {
  taskId: string;
}

/**
 * Push notification configuration
 */
export interface PushNotificationConfig {
  webhookUrl: string;
  events?: TaskState[];
}

/**
 * Parameters for push notification config
 */
export interface PushNotificationConfigParams {
  taskId: string;
  config: PushNotificationConfig;
}

/**
 * Task update event (for streaming/subscriptions)
 */
export interface TaskUpdate {
  type: 'state_change' | 'artifact' | 'message' | 'error';
  task: Task;
  delta?: Partial<Task>;
  timestamp: string;
}

/**
 * Tasks list response
 */
export interface TasksListResponse {
  tasks: Task[];
  total: number;
  hasMore: boolean;
}

/**
 * Helper to create a text message
 */
export function createTextMessage(
  text: string,
  role: MessageRole = 'user'
): Message {
  return {
    role,
    parts: [{ type: 'text', text }],
  };
}

/**
 * Helper to extract text from a message
 */
export function extractText(message: Message): string {
  return message.parts
    .filter((part): part is TextPart => part.type === 'text')
    .map((part) => part.text)
    .join(' ');
}
