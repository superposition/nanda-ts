/**
 * Error Classes Unit Tests
 *
 * Tests for the NANDA SDK error hierarchy.
 */

import { describe, it, expect } from 'bun:test';
import {
  NandaError,
  JsonRpcError,
  JsonRpcErrorCode,
  AuthenticationError,
  DiscoveryError,
  TimeoutError,
  TaskError,
  RegistryError,
  ConnectionError,
  ValidationError,
  type JsonRpcErrorObject,
} from '../../src/types/errors';

describe('NandaError', () => {
  describe('constructor', () => {
    it('should create error with message and code', () => {
      const error = new NandaError('Something went wrong', 'TEST_ERROR');

      expect(error.message).toBe('Something went wrong');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.name).toBe('NandaError');
    });

    it('should extend Error', () => {
      const error = new NandaError('Test', 'CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NandaError);
    });

    it('should have stack trace', () => {
      const error = new NandaError('Test', 'CODE');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('NandaError');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new NandaError('Thrown error', 'THROWN');
      }).toThrow('Thrown error');

      try {
        throw new NandaError('Catch me', 'CATCH');
      } catch (e) {
        expect(e).toBeInstanceOf(NandaError);
        expect((e as NandaError).code).toBe('CATCH');
      }
    });
  });
});

describe('JsonRpcErrorCode', () => {
  it('should have standard JSON-RPC error codes', () => {
    expect(JsonRpcErrorCode.PARSE_ERROR).toBe(-32700);
    expect(JsonRpcErrorCode.INVALID_REQUEST).toBe(-32600);
    expect(JsonRpcErrorCode.METHOD_NOT_FOUND).toBe(-32601);
    expect(JsonRpcErrorCode.INVALID_PARAMS).toBe(-32602);
    expect(JsonRpcErrorCode.INTERNAL_ERROR).toBe(-32603);
  });

  it('should have custom NANDA error codes', () => {
    expect(JsonRpcErrorCode.AUTHENTICATION_FAILED).toBe(-32000);
    expect(JsonRpcErrorCode.TIMEOUT).toBe(-32001);
    expect(JsonRpcErrorCode.DISCOVERY_FAILED).toBe(-32002);
    expect(JsonRpcErrorCode.TASK_NOT_FOUND).toBe(-32003);
    expect(JsonRpcErrorCode.TASK_CANCELLED).toBe(-32004);
    expect(JsonRpcErrorCode.REGISTRATION_FAILED).toBe(-32005);
    expect(JsonRpcErrorCode.RESOLUTION_FAILED).toBe(-32006);
  });

  it('should have codes in valid custom range (-32000 to -32099)', () => {
    const customCodes = [
      JsonRpcErrorCode.AUTHENTICATION_FAILED,
      JsonRpcErrorCode.TIMEOUT,
      JsonRpcErrorCode.DISCOVERY_FAILED,
      JsonRpcErrorCode.TASK_NOT_FOUND,
      JsonRpcErrorCode.TASK_CANCELLED,
      JsonRpcErrorCode.REGISTRATION_FAILED,
      JsonRpcErrorCode.RESOLUTION_FAILED,
    ];

    for (const code of customCodes) {
      expect(code).toBeGreaterThanOrEqual(-32099);
      expect(code).toBeLessThanOrEqual(-32000);
    }
  });
});

describe('JsonRpcError', () => {
  describe('constructor', () => {
    it('should create error with message and rpcCode', () => {
      const error = new JsonRpcError('Method not found', JsonRpcErrorCode.METHOD_NOT_FOUND);

      expect(error.message).toBe('Method not found');
      expect(error.rpcCode).toBe(-32601);
      expect(error.name).toBe('JsonRpcError');
      expect(error.code).toBe('JSON_RPC_ERROR');
    });

    it('should extend NandaError', () => {
      const error = new JsonRpcError('Test', -32600);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NandaError);
      expect(error).toBeInstanceOf(JsonRpcError);
    });

    it('should accept optional data', () => {
      const data = { field: 'value', details: [1, 2, 3] };
      const error = new JsonRpcError('Invalid params', JsonRpcErrorCode.INVALID_PARAMS, data);

      expect(error.data).toEqual(data);
    });

    it('should allow undefined data', () => {
      const error = new JsonRpcError('Error', -32600);

      expect(error.data).toBeUndefined();
    });
  });

  describe('toJSON', () => {
    it('should return JsonRpcErrorObject', () => {
      const error = new JsonRpcError('Parse error', JsonRpcErrorCode.PARSE_ERROR);
      const json = error.toJSON();

      expect(json).toEqual({
        code: -32700,
        message: 'Parse error',
      });
    });

    it('should include data when present', () => {
      const data = { details: 'extra info' };
      const error = new JsonRpcError('Error with data', -32600, data);
      const json = error.toJSON();

      expect(json).toEqual({
        code: -32600,
        message: 'Error with data',
        data: { details: 'extra info' },
      });
    });

    it('should not include data key when undefined', () => {
      const error = new JsonRpcError('No data', -32600);
      const json = error.toJSON();

      expect(json).not.toHaveProperty('data');
      expect(Object.keys(json)).toEqual(['code', 'message']);
    });

    it('should include data when data is null', () => {
      const error = new JsonRpcError('Null data', -32600, null);
      const json = error.toJSON();

      expect(json).toHaveProperty('data');
      expect(json.data).toBeNull();
    });

    it('should include data when data is empty object', () => {
      const error = new JsonRpcError('Empty data', -32600, {});
      const json = error.toJSON();

      expect(json).toHaveProperty('data');
      expect(json.data).toEqual({});
    });
  });

  describe('fromObject', () => {
    it('should create JsonRpcError from JsonRpcErrorObject', () => {
      const obj: JsonRpcErrorObject = {
        code: -32601,
        message: 'Method not found',
      };

      const error = JsonRpcError.fromObject(obj);

      expect(error).toBeInstanceOf(JsonRpcError);
      expect(error.rpcCode).toBe(-32601);
      expect(error.message).toBe('Method not found');
      expect(error.data).toBeUndefined();
    });

    it('should preserve data from object', () => {
      const obj: JsonRpcErrorObject = {
        code: -32602,
        message: 'Invalid params',
        data: { param: 'value' },
      };

      const error = JsonRpcError.fromObject(obj);

      expect(error.data).toEqual({ param: 'value' });
    });

    it('should round-trip through toJSON', () => {
      const original = new JsonRpcError('Round trip', -32603, { key: 'value' });
      const json = original.toJSON();
      const restored = JsonRpcError.fromObject(json);

      expect(restored.message).toBe(original.message);
      expect(restored.rpcCode).toBe(original.rpcCode);
      expect(restored.data).toEqual(original.data);
    });
  });
});

describe('AuthenticationError', () => {
  it('should create error with message', () => {
    const error = new AuthenticationError('Invalid token');

    expect(error.message).toBe('Invalid token');
    expect(error.name).toBe('AuthenticationError');
    expect(error.code).toBe('AUTHENTICATION_ERROR');
    expect(error.did).toBeUndefined();
  });

  it('should extend NandaError', () => {
    const error = new AuthenticationError('Test');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NandaError);
    expect(error).toBeInstanceOf(AuthenticationError);
  });

  it('should accept optional DID', () => {
    const error = new AuthenticationError('Auth failed', 'did:key:z6MkTest');

    expect(error.did).toBe('did:key:z6MkTest');
  });

  it('should be catchable by NandaError type', () => {
    try {
      throw new AuthenticationError('Auth error', 'did:test');
    } catch (e) {
      if (e instanceof NandaError) {
        expect(e.code).toBe('AUTHENTICATION_ERROR');
      }
    }
  });
});

describe('DiscoveryError', () => {
  it('should create error with message', () => {
    const error = new DiscoveryError('Agent not found');

    expect(error.message).toBe('Agent not found');
    expect(error.name).toBe('DiscoveryError');
    expect(error.code).toBe('DISCOVERY_ERROR');
    expect(error.identifier).toBeUndefined();
  });

  it('should extend NandaError', () => {
    const error = new DiscoveryError('Test');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NandaError);
    expect(error).toBeInstanceOf(DiscoveryError);
  });

  it('should accept optional identifier', () => {
    const error = new DiscoveryError('Not found', '@org/agent');

    expect(error.identifier).toBe('@org/agent');
  });

  it('should accept DID as identifier', () => {
    const error = new DiscoveryError('DID not found', 'did:key:z6MkTest');

    expect(error.identifier).toBe('did:key:z6MkTest');
  });

  it('should accept URL as identifier', () => {
    const error = new DiscoveryError('URL unreachable', 'https://example.com');

    expect(error.identifier).toBe('https://example.com');
  });
});

describe('TimeoutError', () => {
  it('should create error with message', () => {
    const error = new TimeoutError('Request timed out');

    expect(error.message).toBe('Request timed out');
    expect(error.name).toBe('TimeoutError');
    expect(error.code).toBe('TIMEOUT_ERROR');
    expect(error.timeoutMs).toBeUndefined();
  });

  it('should extend NandaError', () => {
    const error = new TimeoutError('Test');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NandaError);
    expect(error).toBeInstanceOf(TimeoutError);
  });

  it('should accept optional timeout value', () => {
    const error = new TimeoutError('Timed out after 5s', 5000);

    expect(error.timeoutMs).toBe(5000);
  });

  it('should accept zero timeout', () => {
    const error = new TimeoutError('Zero timeout', 0);

    expect(error.timeoutMs).toBe(0);
  });
});

describe('TaskError', () => {
  it('should create error with message', () => {
    const error = new TaskError('Task failed');

    expect(error.message).toBe('Task failed');
    expect(error.name).toBe('TaskError');
    expect(error.code).toBe('TASK_ERROR');
    expect(error.taskId).toBeUndefined();
    expect(error.state).toBeUndefined();
  });

  it('should extend NandaError', () => {
    const error = new TaskError('Test');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NandaError);
    expect(error).toBeInstanceOf(TaskError);
  });

  it('should accept optional taskId', () => {
    const error = new TaskError('Task not found', 'task-123');

    expect(error.taskId).toBe('task-123');
    expect(error.state).toBeUndefined();
  });

  it('should accept optional state', () => {
    const error = new TaskError('Task cancelled', 'task-456', 'CANCELLED');

    expect(error.taskId).toBe('task-456');
    expect(error.state).toBe('CANCELLED');
  });

  it('should handle all task states', () => {
    const states = ['SUBMITTED', 'WORKING', 'INPUT_REQUIRED', 'COMPLETED', 'FAILED', 'CANCELLED'];

    for (const state of states) {
      const error = new TaskError(`Task in ${state}`, 'task-id', state);
      expect(error.state).toBe(state);
    }
  });
});

describe('RegistryError', () => {
  it('should create error with message', () => {
    const error = new RegistryError('Registry unavailable');

    expect(error.message).toBe('Registry unavailable');
    expect(error.name).toBe('RegistryError');
    expect(error.code).toBe('REGISTRY_ERROR');
    expect(error.handle).toBeUndefined();
  });

  it('should extend NandaError', () => {
    const error = new RegistryError('Test');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NandaError);
    expect(error).toBeInstanceOf(RegistryError);
  });

  it('should accept optional handle', () => {
    const error = new RegistryError('Handle already registered', '@org/agent');

    expect(error.handle).toBe('@org/agent');
  });
});

describe('ConnectionError', () => {
  it('should create error with message', () => {
    const error = new ConnectionError('Connection refused');

    expect(error.message).toBe('Connection refused');
    expect(error.name).toBe('ConnectionError');
    expect(error.code).toBe('CONNECTION_ERROR');
    expect(error.endpoint).toBeUndefined();
  });

  it('should extend NandaError', () => {
    const error = new ConnectionError('Test');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NandaError);
    expect(error).toBeInstanceOf(ConnectionError);
  });

  it('should accept optional endpoint', () => {
    const error = new ConnectionError('Failed to connect', 'https://api.example.com');

    expect(error.endpoint).toBe('https://api.example.com');
  });
});

describe('ValidationError', () => {
  it('should create error with message', () => {
    const error = new ValidationError('Invalid input');

    expect(error.message).toBe('Invalid input');
    expect(error.name).toBe('ValidationError');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.field).toBeUndefined();
    expect(error.value).toBeUndefined();
  });

  it('should extend NandaError', () => {
    const error = new ValidationError('Test');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NandaError);
    expect(error).toBeInstanceOf(ValidationError);
  });

  it('should accept optional field', () => {
    const error = new ValidationError('Field required', 'email');

    expect(error.field).toBe('email');
    expect(error.value).toBeUndefined();
  });

  it('should accept optional value', () => {
    const error = new ValidationError('Invalid value', 'age', -5);

    expect(error.field).toBe('age');
    expect(error.value).toBe(-5);
  });

  it('should handle various value types', () => {
    const testCases = [
      { field: 'string', value: 'test' },
      { field: 'number', value: 42 },
      { field: 'boolean', value: false },
      { field: 'object', value: { key: 'val' } },
      { field: 'array', value: [1, 2, 3] },
      { field: 'null', value: null },
    ];

    for (const { field, value } of testCases) {
      const error = new ValidationError('Invalid', field, value);
      expect(error.value).toEqual(value);
    }
  });
});

describe('Error Hierarchy', () => {
  it('should allow catching all errors by NandaError', () => {
    const errors = [
      new NandaError('Base', 'BASE'),
      new JsonRpcError('RPC', -32600),
      new AuthenticationError('Auth'),
      new DiscoveryError('Discovery'),
      new TimeoutError('Timeout'),
      new TaskError('Task'),
      new RegistryError('Registry'),
      new ConnectionError('Connection'),
      new ValidationError('Validation'),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(NandaError);
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('should have unique error codes', () => {
    const errors = [
      new NandaError('Base', 'BASE'),
      new JsonRpcError('RPC', -32600),
      new AuthenticationError('Auth'),
      new DiscoveryError('Discovery'),
      new TimeoutError('Timeout'),
      new TaskError('Task'),
      new RegistryError('Registry'),
      new ConnectionError('Connection'),
      new ValidationError('Validation'),
    ];

    const codes = errors.map((e) => e.code);
    const uniqueCodes = [...new Set(codes)];

    // BASE is custom, others should all be unique
    expect(uniqueCodes.length).toBe(codes.length);
  });

  it('should have unique error names', () => {
    const errors = [
      new NandaError('Base', 'BASE'),
      new JsonRpcError('RPC', -32600),
      new AuthenticationError('Auth'),
      new DiscoveryError('Discovery'),
      new TimeoutError('Timeout'),
      new TaskError('Task'),
      new RegistryError('Registry'),
      new ConnectionError('Connection'),
      new ValidationError('Validation'),
    ];

    const names = errors.map((e) => e.name);
    const uniqueNames = [...new Set(names)];

    expect(uniqueNames.length).toBe(names.length);
  });

  it('should allow type-specific error handling', () => {
    const handleError = (error: Error): string => {
      if (error instanceof JsonRpcError) {
        return `RPC: ${error.rpcCode}`;
      } else if (error instanceof AuthenticationError) {
        return `Auth: ${error.did}`;
      } else if (error instanceof DiscoveryError) {
        return `Discovery: ${error.identifier}`;
      } else if (error instanceof TimeoutError) {
        return `Timeout: ${error.timeoutMs}`;
      } else if (error instanceof TaskError) {
        return `Task: ${error.taskId}`;
      } else if (error instanceof RegistryError) {
        return `Registry: ${error.handle}`;
      } else if (error instanceof ConnectionError) {
        return `Connection: ${error.endpoint}`;
      } else if (error instanceof ValidationError) {
        return `Validation: ${error.field}`;
      } else if (error instanceof NandaError) {
        return `Nanda: ${error.code}`;
      }
      return 'Unknown';
    };

    expect(handleError(new JsonRpcError('Test', -32600))).toBe('RPC: -32600');
    expect(handleError(new AuthenticationError('Test', 'did:test'))).toBe('Auth: did:test');
    expect(handleError(new DiscoveryError('Test', '@org/agent'))).toBe('Discovery: @org/agent');
    expect(handleError(new TimeoutError('Test', 5000))).toBe('Timeout: 5000');
    expect(handleError(new TaskError('Test', 'task-1'))).toBe('Task: task-1');
    expect(handleError(new RegistryError('Test', '@org/reg'))).toBe('Registry: @org/reg');
    expect(handleError(new ConnectionError('Test', 'http://x.com'))).toBe('Connection: http://x.com');
    expect(handleError(new ValidationError('Test', 'email'))).toBe('Validation: email');
    expect(handleError(new NandaError('Test', 'CUSTOM'))).toBe('Nanda: CUSTOM');
  });
});
