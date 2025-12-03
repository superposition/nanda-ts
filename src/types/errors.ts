/**
 * Error types for the NANDA SDK
 */

/**
 * Base error class for all NANDA errors
 */
export class NandaError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'NandaError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Standard JSON-RPC 2.0 error codes
 */
export enum JsonRpcErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  // Custom NANDA error codes (-32000 to -32099)
  AUTHENTICATION_FAILED = -32000,
  TIMEOUT = -32001,
  DISCOVERY_FAILED = -32002,
  TASK_NOT_FOUND = -32003,
  TASK_CANCELLED = -32004,
  REGISTRATION_FAILED = -32005,
  RESOLUTION_FAILED = -32006,
}

/**
 * JSON-RPC error object structure
 */
export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC specific error
 */
export class JsonRpcError extends NandaError {
  constructor(
    message: string,
    public readonly rpcCode: number,
    public readonly data?: unknown
  ) {
    super(message, 'JSON_RPC_ERROR');
    this.name = 'JsonRpcError';
  }

  toJSON(): JsonRpcErrorObject {
    return {
      code: this.rpcCode,
      message: this.message,
      ...(this.data !== undefined && { data: this.data }),
    };
  }

  static fromObject(error: JsonRpcErrorObject): JsonRpcError {
    return new JsonRpcError(error.message, error.code, error.data);
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends NandaError {
  constructor(message: string, public readonly did?: string) {
    super(message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

/**
 * Agent discovery error
 */
export class DiscoveryError extends NandaError {
  constructor(message: string, public readonly identifier?: string) {
    super(message, 'DISCOVERY_ERROR');
    this.name = 'DiscoveryError';
  }
}

/**
 * Request timeout error
 */
export class TimeoutError extends NandaError {
  constructor(message: string, public readonly timeoutMs?: number) {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
  }
}

/**
 * Task-related error
 */
export class TaskError extends NandaError {
  constructor(
    message: string,
    public readonly taskId?: string,
    public readonly state?: string
  ) {
    super(message, 'TASK_ERROR');
    this.name = 'TaskError';
  }
}

/**
 * Registry-related error
 */
export class RegistryError extends NandaError {
  constructor(message: string, public readonly handle?: string) {
    super(message, 'REGISTRY_ERROR');
    this.name = 'RegistryError';
  }
}

/**
 * Connection error
 */
export class ConnectionError extends NandaError {
  constructor(message: string, public readonly endpoint?: string) {
    super(message, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends NandaError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}
