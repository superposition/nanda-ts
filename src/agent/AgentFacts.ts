/**
 * AgentFacts Builder and Validator
 */

import type {
  AgentFacts,
  CoreIdentity,
  BaselineModel,
  Classification,
  AgentFactsCapabilities,
  AuthenticationPermissions,
  ComplianceRegulatory,
  PerformanceReputation,
  SupplyChain,
  Verification,
  Skill,
} from '../types';
import { ValidationError } from '../types';

/**
 * AgentFacts Builder
 *
 * Fluent builder for creating AgentFacts objects.
 */
export class AgentFactsBuilder {
  private facts: Partial<AgentFacts> = {};

  /**
   * Set core identity (required)
   */
  coreIdentity(identity: CoreIdentity): this {
    this.facts.core_identity = identity;
    return this;
  }

  /**
   * Set baseline model (required)
   */
  baselineModel(model: BaselineModel): this {
    this.facts.baseline_model = model;
    return this;
  }

  /**
   * Set classification
   */
  classification(classification: Classification): this {
    this.facts.classification = classification;
    return this;
  }

  /**
   * Set capabilities
   */
  capabilities(capabilities: AgentFactsCapabilities): this {
    this.facts.capabilities = capabilities;
    return this;
  }

  /**
   * Add skills to capabilities
   */
  addSkills(skills: Skill[]): this {
    if (!this.facts.capabilities) {
      this.facts.capabilities = {
        skills: [],
        supported_protocols: [],
        input_modes: ['text'],
        output_modes: ['text'],
        streaming_support: false,
      };
    }
    this.facts.capabilities.skills.push(...skills);
    return this;
  }

  /**
   * Set supported protocols
   */
  protocols(protocols: string[]): this {
    if (!this.facts.capabilities) {
      this.facts.capabilities = {
        skills: [],
        supported_protocols: protocols,
        input_modes: ['text'],
        output_modes: ['text'],
        streaming_support: false,
      };
    } else {
      this.facts.capabilities.supported_protocols = protocols;
    }
    return this;
  }

  /**
   * Set authentication permissions
   */
  authentication(auth: AuthenticationPermissions): this {
    this.facts.authentication_permissions = auth;
    return this;
  }

  /**
   * Set compliance information
   */
  compliance(compliance: ComplianceRegulatory): this {
    this.facts.compliance_regulatory = compliance;
    return this;
  }

  /**
   * Set performance metrics
   */
  performance(performance: PerformanceReputation): this {
    this.facts.performance_reputation = performance;
    return this;
  }

  /**
   * Set supply chain information
   */
  supplyChain(supplyChain: SupplyChain): this {
    this.facts.supply_chain = supplyChain;
    return this;
  }

  /**
   * Set verification status
   */
  verification(verification: Verification): this {
    this.facts.verification = verification;
    return this;
  }

  /**
   * Set custom extension fields
   */
  extend(extensions: Record<string, unknown>): this {
    this.facts.extensibility = {
      ...this.facts.extensibility,
      ...extensions,
    };
    return this;
  }

  /**
   * Build and validate the AgentFacts
   */
  build(): AgentFacts {
    if (!this.facts.core_identity) {
      throw new ValidationError('core_identity is required', 'core_identity');
    }
    if (!this.facts.baseline_model) {
      throw new ValidationError('baseline_model is required', 'baseline_model');
    }

    return this.facts as AgentFacts;
  }
}

/**
 * Create an AgentFacts builder
 */
export function createAgentFactsBuilder(): AgentFactsBuilder {
  return new AgentFactsBuilder();
}

/**
 * Validate AgentFacts structure
 */
export function validateAgentFacts(facts: unknown): facts is AgentFacts {
  if (!facts || typeof facts !== 'object') {
    return false;
  }

  const f = facts as Record<string, unknown>;

  // Check required fields
  if (!f.core_identity || typeof f.core_identity !== 'object') {
    return false;
  }
  if (!f.baseline_model || typeof f.baseline_model !== 'object') {
    return false;
  }

  // Validate core_identity
  const identity = f.core_identity as Record<string, unknown>;
  if (
    typeof identity.agent_id !== 'string' ||
    typeof identity.agent_name !== 'string' ||
    typeof identity.version !== 'string' ||
    typeof identity.description !== 'string' ||
    typeof identity.provider !== 'string'
  ) {
    return false;
  }

  // Validate baseline_model
  const model = f.baseline_model as Record<string, unknown>;
  if (typeof model.model_name !== 'string') {
    return false;
  }

  return true;
}

/**
 * Parse and validate AgentFacts
 */
export function parseAgentFacts(data: unknown): AgentFacts {
  if (!validateAgentFacts(data)) {
    throw new ValidationError('Invalid AgentFacts structure');
  }
  return data;
}

/**
 * Create a minimal AgentFacts object
 */
export function createMinimalAgentFacts(
  agentId: string,
  agentName: string,
  description: string,
  provider: string,
  modelName: string
): AgentFacts {
  return {
    core_identity: {
      agent_id: agentId,
      agent_name: agentName,
      version: '1.0.0',
      description,
      provider,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    baseline_model: {
      model_name: modelName,
    },
  };
}
