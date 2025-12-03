/**
 * Agent, AgentCard, and AgentFacts types
 */

import type { ContentMode } from './protocol';

/**
 * Agent Skill definition
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  examples?: string[];
  inputModes?: ContentMode[];
  outputModes?: ContentMode[];
}

/**
 * Agent capabilities
 */
export interface AgentCapabilities {
  streaming: boolean;
  pushNotifications: boolean;
  stateTransitionHistory?: boolean;
}

/**
 * Agent provider information
 */
export interface Provider {
  organization?: string;
  url?: string;
}

/**
 * Security scheme for authentication
 */
export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2';
  name?: string;
  in?: 'header' | 'query';
  scheme?: string;
  bearerFormat?: string;
}

/**
 * A2A Agent Card - discovery document at /.well-known/agent.json
 */
export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  defaultInputModes: ContentMode[];
  defaultOutputModes: ContentMode[];
  capabilities: AgentCapabilities;
  skills: Skill[];
  provider?: Provider;
  documentationUrl?: string;
  securitySchemes?: SecurityScheme[];
}

// --- AgentFacts Types (NANDA-specific) ---

/**
 * Core identity information (required)
 */
export interface CoreIdentity {
  agent_id: string;
  agent_name: string; // URN format: @org/agent-name
  version: string;
  description: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

/**
 * Baseline model information (required)
 */
export interface BaselineModel {
  model_name: string;
  model_version?: string;
  model_provider?: string;
  training_data_cutoff?: string;
}

/**
 * Classification information
 */
export interface Classification {
  category: string;
  subcategories?: string[];
  tags?: string[];
}

/**
 * Agent capabilities (AgentFacts version)
 */
export interface AgentFactsCapabilities {
  skills: Skill[];
  supported_protocols: string[]; // 'a2a', 'mcp', 'nlweb', 'https'
  input_modes: ContentMode[];
  output_modes: ContentMode[];
  max_context_length?: number;
  streaming_support: boolean;
}

/**
 * Authentication and permissions
 */
export interface AuthenticationPermissions {
  supported_methods: string[];
  required_scopes?: string[];
  data_access_levels?: string[];
  jwks_url?: string;
}

/**
 * Compliance and regulatory information
 */
export interface ComplianceRegulatory {
  certifications?: string[];
  data_residency?: string[];
  privacy_standards?: string[];
}

/**
 * Performance and reputation metrics
 */
export interface PerformanceReputation {
  response_time_ms?: number;
  uptime_percentage?: number;
  trust_score?: number;
  rating?: number;
  reviews_count?: number;
}

/**
 * Dependency definition
 */
export interface Dependency {
  name: string;
  version: string;
  type: 'model' | 'tool' | 'service';
}

/**
 * Supply chain information
 */
export interface SupplyChain {
  dependencies?: Dependency[];
  parent_agents?: string[];
  child_agents?: string[];
}

/**
 * Verification status
 */
export interface Verification {
  verified: boolean;
  verification_date?: string;
  verification_method?: string;
  credential_url?: string; // W3C Verifiable Credential URL
}

/**
 * AgentFacts - NANDA's cryptographically verifiable agent metadata
 */
export interface AgentFacts {
  // Required fields
  core_identity: CoreIdentity;
  baseline_model: BaselineModel;

  // Optional fields
  classification?: Classification;
  capabilities?: AgentFactsCapabilities;
  authentication_permissions?: AuthenticationPermissions;
  compliance_regulatory?: ComplianceRegulatory;
  performance_reputation?: PerformanceReputation;
  supply_chain?: SupplyChain;
  verification?: Verification;
  extensibility?: Record<string, unknown>;
}

/**
 * Agent endpoints
 */
export interface AgentEndpoints {
  a2a?: string;
  mcp?: string;
  nlweb?: string;
  health?: string;
  facts?: string;
}

/**
 * Complete agent information (resolved)
 */
export interface ResolvedAgent {
  id: string;
  handle: string;
  agentCard?: AgentCard;
  agentFacts?: AgentFacts;
  endpoints: AgentEndpoints;
  resolvedAt: Date;
}

/**
 * Agent configuration for creating a new agent
 */
export interface AgentConfig {
  id?: string;
  name: string;
  description: string;
  version?: string;
  skills?: Skill[];
  capabilities?: Partial<AgentCapabilities>;
  provider?: Provider;
  baselineModel?: BaselineModel;
}

/**
 * Create a default AgentCard from config
 */
export function createAgentCard(
  config: AgentConfig,
  url: string
): AgentCard {
  return {
    name: config.name,
    description: config.description,
    url,
    version: config.version ?? '1.0.0',
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    capabilities: {
      streaming: config.capabilities?.streaming ?? true,
      pushNotifications: config.capabilities?.pushNotifications ?? false,
      stateTransitionHistory: config.capabilities?.stateTransitionHistory ?? false,
    },
    skills: config.skills ?? [],
    provider: config.provider,
  };
}
