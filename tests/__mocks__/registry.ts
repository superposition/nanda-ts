/**
 * Mock Registry Data
 *
 * Provides mock registry responses for testing.
 */

import type { AgentFacts, AgentCard, Skill } from '../../src/types';

/**
 * Mock agent data
 */
export interface MockAgent {
  handle: string;
  agentId: string;
  agentName: string;
  description: string;
  factsUrl: string;
  card: AgentCard;
  facts: AgentFacts;
}

/**
 * Create a mock skill
 */
export function createMockSkill(id: string, name: string): Skill {
  return {
    id,
    name,
    description: `Mock skill: ${name}`,
    tags: ['mock', 'test'],
    inputModes: ['text'],
    outputModes: ['text'],
  };
}

/**
 * Create a mock agent card
 */
export function createMockAgentCard(handle: string, port: number): AgentCard {
  return {
    name: handle,
    description: `Mock agent: ${handle}`,
    url: `http://localhost:${port}`,
    version: '1.0.0',
    provider: {
      organization: 'Test Organization',
    },
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    skills: [createMockSkill('echo', 'Echo')],
    authentication: {
      schemes: [],
    },
  };
}

/**
 * Create a mock agent facts
 */
export function createMockAgentFacts(handle: string): AgentFacts {
  return {
    core_identity: {
      agent_id: `agent-${handle}`,
      agent_name: handle,
      version: '1.0.0',
      description: `Mock agent: ${handle}`,
      provider: 'Test Organization',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    baseline_model: {
      model_name: 'mock-model',
    },
    capabilities: {
      skills: [
        {
          skill_id: 'echo',
          name: 'Echo',
          description: 'Echoes messages',
          input_modes: ['text'],
          output_modes: ['text'],
        },
      ],
      supported_protocols: ['a2a'],
      input_modes: ['text'],
      output_modes: ['text'],
      streaming_support: true,
    },
  };
}

/**
 * Create a complete mock agent
 */
export function createMockAgent(handle: string, port: number): MockAgent {
  return {
    handle,
    agentId: `agent-${handle}`,
    agentName: handle,
    description: `Mock agent: ${handle}`,
    factsUrl: `http://localhost:${port}/.well-known/agent-facts.json`,
    card: createMockAgentCard(handle, port),
    facts: createMockAgentFacts(handle),
  };
}

/**
 * Mock registry responses
 */
export const MOCK_REGISTRY_AGENTS: MockAgent[] = [
  createMockAgent('test-agent-1', 3001),
  createMockAgent('test-agent-2', 3002),
  createMockAgent('echo-agent', 3003),
];

/**
 * Find mock agent by handle
 */
export function findMockAgent(handle: string): MockAgent | undefined {
  return MOCK_REGISTRY_AGENTS.find((a) => a.handle === handle);
}

/**
 * Search mock agents
 */
export function searchMockAgents(query: string): MockAgent[] {
  const lowerQuery = query.toLowerCase();
  return MOCK_REGISTRY_AGENTS.filter(
    (a) =>
      a.handle.toLowerCase().includes(lowerQuery) ||
      a.agentName.toLowerCase().includes(lowerQuery) ||
      a.description.toLowerCase().includes(lowerQuery)
  );
}
