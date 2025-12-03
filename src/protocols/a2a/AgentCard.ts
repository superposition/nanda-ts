/**
 * Agent Card utilities
 */

import type { AgentCard, Skill, AgentCapabilities } from '../../types';
import { ValidationError } from '../../types';

/**
 * Well-known path for Agent Card discovery
 */
export const AGENT_CARD_PATH = '/.well-known/agent.json';

/**
 * Validate an Agent Card structure
 */
export function validateAgentCard(card: unknown): card is AgentCard {
  if (!card || typeof card !== 'object') {
    return false;
  }

  const c = card as Record<string, unknown>;

  // Required string fields
  const requiredStrings = ['name', 'description', 'url', 'version'];
  for (const field of requiredStrings) {
    if (typeof c[field] !== 'string' || c[field] === '') {
      return false;
    }
  }

  // Required arrays
  if (!Array.isArray(c.defaultInputModes) || c.defaultInputModes.length === 0) {
    return false;
  }
  if (!Array.isArray(c.defaultOutputModes) || c.defaultOutputModes.length === 0) {
    return false;
  }
  if (!Array.isArray(c.skills)) {
    return false;
  }

  // Required capabilities object
  if (!c.capabilities || typeof c.capabilities !== 'object') {
    return false;
  }

  return true;
}

/**
 * Parse and validate an Agent Card, throwing on errors
 */
export function parseAgentCard(data: unknown): AgentCard {
  if (!validateAgentCard(data)) {
    throw new ValidationError('Invalid Agent Card structure');
  }
  return data;
}

/**
 * Create a minimal valid Agent Card
 */
export function createMinimalAgentCard(
  name: string,
  description: string,
  url: string
): AgentCard {
  return {
    name,
    description,
    url,
    version: '1.0.0',
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    skills: [],
  };
}

/**
 * Merge skills into an Agent Card
 */
export function withSkills(card: AgentCard, skills: Skill[]): AgentCard {
  return {
    ...card,
    skills: [...card.skills, ...skills],
  };
}

/**
 * Update capabilities on an Agent Card
 */
export function withCapabilities(
  card: AgentCard,
  capabilities: Partial<AgentCapabilities>
): AgentCard {
  return {
    ...card,
    capabilities: {
      ...card.capabilities,
      ...capabilities,
    },
  };
}

/**
 * Get the full URL for the Agent Card endpoint
 */
export function getAgentCardUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.pathname = AGENT_CARD_PATH;
  return url.toString();
}

/**
 * Find a skill by ID
 */
export function findSkill(card: AgentCard, skillId: string): Skill | undefined {
  return card.skills.find((skill) => skill.id === skillId);
}

/**
 * Check if an agent has a specific capability
 */
export function hasCapability(
  card: AgentCard,
  capability: keyof AgentCapabilities
): boolean {
  return card.capabilities[capability] === true;
}

/**
 * Get all skill IDs from an Agent Card
 */
export function getSkillIds(card: AgentCard): string[] {
  return card.skills.map((skill) => skill.id);
}

/**
 * Check if an agent supports a specific input mode
 */
export function supportsInputMode(
  card: AgentCard,
  mode: string,
  skillId?: string
): boolean {
  if (skillId) {
    const skill = findSkill(card, skillId);
    if (skill?.inputModes) {
      return skill.inputModes.includes(mode as never);
    }
  }
  return card.defaultInputModes.includes(mode as never);
}

/**
 * Check if an agent supports a specific output mode
 */
export function supportsOutputMode(
  card: AgentCard,
  mode: string,
  skillId?: string
): boolean {
  if (skillId) {
    const skill = findSkill(card, skillId);
    if (skill?.outputModes) {
      return skill.outputModes.includes(mode as never);
    }
  }
  return card.defaultOutputModes.includes(mode as never);
}
