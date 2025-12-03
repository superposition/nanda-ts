/**
 * AgentFacts Builder Unit Tests
 *
 * Tests for the AgentFacts builder and validator.
 */

import { describe, it, expect } from 'bun:test';
import {
  AgentFactsBuilder,
  createAgentFactsBuilder,
  validateAgentFacts,
  parseAgentFacts,
  createMinimalAgentFacts,
} from '../../src/agent/AgentFacts';
import { ValidationError } from '../../src/types';

describe('AgentFactsBuilder', () => {
  const validCoreIdentity = {
    agent_id: 'agent-123',
    agent_name: '@org/my-agent',
    version: '1.0.0',
    description: 'A test agent',
    provider: 'Test Provider',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const validBaselineModel = {
    model_name: 'gpt-4',
    model_version: '2024-01',
    model_provider: 'OpenAI',
  };

  describe('build', () => {
    it('should build with required fields', () => {
      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .build();

      expect(facts.core_identity).toEqual(validCoreIdentity);
      expect(facts.baseline_model).toEqual(validBaselineModel);
    });

    it('should throw if core_identity is missing', () => {
      const builder = new AgentFactsBuilder().baselineModel(validBaselineModel);

      expect(() => builder.build()).toThrow(ValidationError);
      expect(() => builder.build()).toThrow('core_identity is required');
    });

    it('should throw if baseline_model is missing', () => {
      const builder = new AgentFactsBuilder().coreIdentity(validCoreIdentity);

      expect(() => builder.build()).toThrow(ValidationError);
      expect(() => builder.build()).toThrow('baseline_model is required');
    });
  });

  describe('classification', () => {
    it('should set classification', () => {
      const classification = {
        risk_level: 'low' as const,
        domain: 'general',
        categories: ['assistant', 'productivity'],
      };

      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .classification(classification)
        .build();

      expect(facts.classification).toEqual(classification);
    });
  });

  describe('capabilities', () => {
    it('should set capabilities', () => {
      const capabilities = {
        skills: [
          {
            id: 'translate',
            name: 'Translation',
            description: 'Translate text',
            inputModes: ['text' as const],
            outputModes: ['text' as const],
          },
        ],
        supported_protocols: ['a2a', 'mcp'],
        input_modes: ['text' as const, 'image' as const],
        output_modes: ['text' as const],
        streaming_support: true,
      };

      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .capabilities(capabilities)
        .build();

      expect(facts.capabilities).toEqual(capabilities);
    });
  });

  describe('addSkills', () => {
    it('should add skills to capabilities', () => {
      const skills = [
        {
          id: 'search',
          name: 'Search',
          description: 'Web search',
          inputModes: ['text' as const],
          outputModes: ['text' as const],
        },
      ];

      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .addSkills(skills)
        .build();

      expect(facts.capabilities?.skills).toHaveLength(1);
      expect(facts.capabilities?.skills[0].id).toBe('search');
    });

    it('should create capabilities if not set', () => {
      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .addSkills([
          {
            id: 'skill1',
            name: 'Skill 1',
            description: 'First skill',
            inputModes: ['text' as const],
            outputModes: ['text' as const],
          },
        ])
        .build();

      expect(facts.capabilities).toBeDefined();
      expect(facts.capabilities?.skills).toHaveLength(1);
      expect(facts.capabilities?.input_modes).toContain('text');
      expect(facts.capabilities?.streaming_support).toBe(false);
    });

    it('should append skills to existing capabilities', () => {
      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .addSkills([
          {
            id: 'skill1',
            name: 'Skill 1',
            description: 'First',
            inputModes: ['text' as const],
            outputModes: ['text' as const],
          },
        ])
        .addSkills([
          {
            id: 'skill2',
            name: 'Skill 2',
            description: 'Second',
            inputModes: ['text' as const],
            outputModes: ['text' as const],
          },
        ])
        .build();

      expect(facts.capabilities?.skills).toHaveLength(2);
    });
  });

  describe('protocols', () => {
    it('should set protocols', () => {
      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .protocols(['a2a', 'mcp', 'nlweb'])
        .build();

      expect(facts.capabilities?.supported_protocols).toEqual(['a2a', 'mcp', 'nlweb']);
    });

    it('should create capabilities if not set', () => {
      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .protocols(['a2a'])
        .build();

      expect(facts.capabilities).toBeDefined();
      expect(facts.capabilities?.supported_protocols).toEqual(['a2a']);
    });

    it('should update protocols in existing capabilities', () => {
      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .addSkills([
          {
            id: 'test',
            name: 'Test',
            description: 'Test',
            inputModes: ['text' as const],
            outputModes: ['text' as const],
          },
        ])
        .protocols(['updated-protocol'])
        .build();

      expect(facts.capabilities?.supported_protocols).toEqual(['updated-protocol']);
      expect(facts.capabilities?.skills).toHaveLength(1);
    });
  });

  describe('authentication', () => {
    it('should set authentication permissions', () => {
      const auth = {
        authentication_methods: ['api_key', 'oauth2'],
        permission_scopes: ['read', 'write'],
        data_access_levels: ['public', 'internal'],
      };

      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .authentication(auth)
        .build();

      expect(facts.authentication_permissions).toEqual(auth);
    });
  });

  describe('compliance', () => {
    it('should set compliance information', () => {
      const compliance = {
        certifications: ['SOC2', 'ISO27001'],
        regulatory_frameworks: ['GDPR', 'HIPAA'],
        content_policies: ['safe-for-work'],
      };

      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .compliance(compliance)
        .build();

      expect(facts.compliance_regulatory).toEqual(compliance);
    });
  });

  describe('performance', () => {
    it('should set performance metrics', () => {
      const performance = {
        response_time_p50_ms: 200,
        response_time_p99_ms: 1000,
        uptime_percentage: 99.9,
        rating: 4.5,
        total_interactions: 10000,
      };

      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .performance(performance)
        .build();

      expect(facts.performance_reputation).toEqual(performance);
    });
  });

  describe('supplyChain', () => {
    it('should set supply chain information', () => {
      const supplyChain = {
        dependencies: ['openai-api', 'redis'],
        data_sources: ['wikipedia', 'internal-docs'],
        third_party_services: ['stripe'],
      };

      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .supplyChain(supplyChain)
        .build();

      expect(facts.supply_chain).toEqual(supplyChain);
    });
  });

  describe('verification', () => {
    it('should set verification status', () => {
      const verification = {
        verified: true,
        verification_authority: 'NANDA Registry',
        verification_date: '2024-01-15T00:00:00Z',
        verification_expiry: '2025-01-15T00:00:00Z',
      };

      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .verification(verification)
        .build();

      expect(facts.verification).toEqual(verification);
    });
  });

  describe('extend', () => {
    it('should add extension fields', () => {
      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .extend({ custom_field: 'value', another: 123 })
        .build();

      expect(facts.extensibility?.custom_field).toBe('value');
      expect(facts.extensibility?.another).toBe(123);
    });

    it('should merge multiple extensions', () => {
      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .extend({ field1: 'a' })
        .extend({ field2: 'b' })
        .build();

      expect(facts.extensibility?.field1).toBe('a');
      expect(facts.extensibility?.field2).toBe('b');
    });
  });

  describe('fluent chaining', () => {
    it('should support full fluent chain', () => {
      const facts = new AgentFactsBuilder()
        .coreIdentity(validCoreIdentity)
        .baselineModel(validBaselineModel)
        .classification({ risk_level: 'medium', domain: 'healthcare', categories: ['medical'] })
        .capabilities({
          skills: [],
          supported_protocols: ['a2a'],
          input_modes: ['text'],
          output_modes: ['text'],
          streaming_support: true,
        })
        .authentication({ authentication_methods: ['oauth2'] })
        .compliance({ certifications: ['HIPAA'] })
        .performance({ uptime_percentage: 99.99 })
        .supplyChain({ dependencies: ['medical-api'] })
        .verification({ verified: true })
        .extend({ hipaa_compliant: true })
        .build();

      expect(facts.core_identity.agent_id).toBe('agent-123');
      expect(facts.classification?.risk_level).toBe('medium');
      expect(facts.capabilities?.streaming_support).toBe(true);
      expect(facts.authentication_permissions?.authentication_methods).toContain('oauth2');
      expect(facts.compliance_regulatory?.certifications).toContain('HIPAA');
      expect(facts.performance_reputation?.uptime_percentage).toBe(99.99);
      expect(facts.supply_chain?.dependencies).toContain('medical-api');
      expect(facts.verification?.verified).toBe(true);
      expect(facts.extensibility?.hipaa_compliant).toBe(true);
    });
  });
});

describe('createAgentFactsBuilder', () => {
  it('should create a new builder instance', () => {
    const builder = createAgentFactsBuilder();
    expect(builder).toBeInstanceOf(AgentFactsBuilder);
  });
});

describe('validateAgentFacts', () => {
  const validFacts = {
    core_identity: {
      agent_id: 'agent-1',
      agent_name: '@test/agent',
      version: '1.0.0',
      description: 'Test',
      provider: 'Test Provider',
    },
    baseline_model: {
      model_name: 'test-model',
    },
  };

  it('should return true for valid facts', () => {
    expect(validateAgentFacts(validFacts)).toBe(true);
  });

  it('should return false for null', () => {
    expect(validateAgentFacts(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(validateAgentFacts(undefined)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(validateAgentFacts('string')).toBe(false);
    expect(validateAgentFacts(123)).toBe(false);
    expect(validateAgentFacts([])).toBe(false);
  });

  it('should return false for missing core_identity', () => {
    expect(validateAgentFacts({ baseline_model: { model_name: 'test' } })).toBe(false);
  });

  it('should return false for non-object core_identity', () => {
    expect(
      validateAgentFacts({ core_identity: 'string', baseline_model: { model_name: 'test' } })
    ).toBe(false);
  });

  it('should return false for missing baseline_model', () => {
    expect(
      validateAgentFacts({
        core_identity: {
          agent_id: 'a',
          agent_name: 'b',
          version: '1',
          description: 'd',
          provider: 'p',
        },
      })
    ).toBe(false);
  });

  it('should return false for non-object baseline_model', () => {
    expect(
      validateAgentFacts({
        core_identity: {
          agent_id: 'a',
          agent_name: 'b',
          version: '1',
          description: 'd',
          provider: 'p',
        },
        baseline_model: 'string',
      })
    ).toBe(false);
  });

  it('should return false for missing core_identity fields', () => {
    const testCases = [
      { agent_name: 'b', version: '1', description: 'd', provider: 'p' }, // missing agent_id
      { agent_id: 'a', version: '1', description: 'd', provider: 'p' }, // missing agent_name
      { agent_id: 'a', agent_name: 'b', description: 'd', provider: 'p' }, // missing version
      { agent_id: 'a', agent_name: 'b', version: '1', provider: 'p' }, // missing description
      { agent_id: 'a', agent_name: 'b', version: '1', description: 'd' }, // missing provider
    ];

    for (const identity of testCases) {
      expect(
        validateAgentFacts({
          core_identity: identity,
          baseline_model: { model_name: 'test' },
        })
      ).toBe(false);
    }
  });

  it('should return false for non-string core_identity fields', () => {
    expect(
      validateAgentFacts({
        core_identity: {
          agent_id: 123, // should be string
          agent_name: 'b',
          version: '1',
          description: 'd',
          provider: 'p',
        },
        baseline_model: { model_name: 'test' },
      })
    ).toBe(false);
  });

  it('should return false for missing model_name in baseline_model', () => {
    expect(
      validateAgentFacts({
        core_identity: {
          agent_id: 'a',
          agent_name: 'b',
          version: '1',
          description: 'd',
          provider: 'p',
        },
        baseline_model: { model_version: '1.0' }, // missing model_name
      })
    ).toBe(false);
  });

  it('should return false for non-string model_name', () => {
    expect(
      validateAgentFacts({
        core_identity: {
          agent_id: 'a',
          agent_name: 'b',
          version: '1',
          description: 'd',
          provider: 'p',
        },
        baseline_model: { model_name: 123 }, // should be string
      })
    ).toBe(false);
  });
});

describe('parseAgentFacts', () => {
  const validFacts = {
    core_identity: {
      agent_id: 'agent-1',
      agent_name: '@test/agent',
      version: '1.0.0',
      description: 'Test',
      provider: 'Test Provider',
    },
    baseline_model: {
      model_name: 'test-model',
    },
  };

  it('should return valid facts', () => {
    const parsed = parseAgentFacts(validFacts);
    expect(parsed).toEqual(validFacts);
  });

  it('should throw ValidationError for invalid facts', () => {
    expect(() => parseAgentFacts(null)).toThrow(ValidationError);
    expect(() => parseAgentFacts({})).toThrow(ValidationError);
    expect(() => parseAgentFacts({ core_identity: {} })).toThrow(ValidationError);
  });

  it('should throw with correct message', () => {
    try {
      parseAgentFacts({});
      expect(true).toBe(false);
    } catch (error) {
      expect((error as ValidationError).message).toBe('Invalid AgentFacts structure');
    }
  });
});

describe('createMinimalAgentFacts', () => {
  it('should create minimal facts with required fields', () => {
    const facts = createMinimalAgentFacts(
      'agent-123',
      '@test/minimal-agent',
      'A minimal test agent',
      'Test Provider',
      'gpt-4'
    );

    expect(facts.core_identity.agent_id).toBe('agent-123');
    expect(facts.core_identity.agent_name).toBe('@test/minimal-agent');
    expect(facts.core_identity.description).toBe('A minimal test agent');
    expect(facts.core_identity.provider).toBe('Test Provider');
    expect(facts.core_identity.version).toBe('1.0.0');
    expect(facts.baseline_model.model_name).toBe('gpt-4');
  });

  it('should set created_at and updated_at to current time', () => {
    const before = new Date().toISOString();
    const facts = createMinimalAgentFacts('id', 'name', 'desc', 'provider', 'model');
    const after = new Date().toISOString();

    expect(facts.core_identity.created_at).toBeDefined();
    expect(facts.core_identity.updated_at).toBeDefined();

    // Check timestamps are in valid range
    expect(facts.core_identity.created_at! >= before).toBe(true);
    expect(facts.core_identity.updated_at! <= after).toBe(true);
  });

  it('should create valid AgentFacts', () => {
    const facts = createMinimalAgentFacts('id', 'name', 'desc', 'provider', 'model');

    expect(validateAgentFacts(facts)).toBe(true);
  });
});
