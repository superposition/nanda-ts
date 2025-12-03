/**
 * Type exports for nanda-ts
 */

// Error types
export {
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
} from './errors';

// Protocol types
export {
  type JsonRpcRequest,
  type JsonRpcResponse,
  type AuthenticatedJsonRpcRequest,
  type TaskState,
  type MessageRole,
  type ContentMode,
  type TextPart,
  type FilePart,
  type DataPart,
  type Part,
  type FileContent,
  type Message,
  type Artifact,
  type Task,
  type TaskConfiguration,
  type MessageSendParams,
  type TasksGetParams,
  type TasksListParams,
  type TasksCancelParams,
  type TasksSubscribeParams,
  type PushNotificationConfig,
  type PushNotificationConfigParams,
  type TaskUpdate,
  type TasksListResponse,
  createTextMessage,
  extractText,
} from './protocol';

// Agent types
export {
  type Skill,
  type AgentCapabilities,
  type Provider,
  type SecurityScheme,
  type AgentCard,
  type CoreIdentity,
  type BaselineModel,
  type Classification,
  type AgentFactsCapabilities,
  type AuthenticationPermissions,
  type ComplianceRegulatory,
  type PerformanceReputation,
  type Dependency,
  type SupplyChain,
  type Verification,
  type AgentFacts,
  type AgentEndpoints,
  type ResolvedAgent,
  type AgentConfig,
  createAgentCard,
} from './agent';

// Registry types
export {
  type RegistryConfig,
  type AgentAddr,
  type RegisterAgentRequest,
  type RegisterAgentResponse,
  type SearchAgentsParams,
  type SearchAgentsResult,
  type FullyResolvedAgent,
  type CacheEntry,
  type CacheConfig,
  type QuiltConfig,
  type AgentMetadata,
  type DiscoveryCriteria,
  parseHandle,
  createHandle,
  isValidHandle,
  isUrl,
  isDid,
} from './registry';
