/**
 * AgentCard Utilities Unit Tests
 *
 * Tests for Agent Card validation, parsing, and helper functions.
 */

import { describe, it, expect } from 'bun:test';
import {
  AGENT_CARD_PATH,
  validateAgentCard,
  parseAgentCard,
  createMinimalAgentCard,
  withSkills,
  withCapabilities,
  getAgentCardUrl,
  findSkill,
  hasCapability,
  getSkillIds,
  supportsInputMode,
  supportsOutputMode,
} from '../../src/protocols/a2a/AgentCard';
import { ValidationError } from '../../src/types';
import type { AgentCard, Skill } from '../../src/types';

/**
 * Helper to create a valid AgentCard for testing
 */
function createValidCard(overrides: Partial<AgentCard> = {}): AgentCard {
  return {
    name: 'test-agent',
    description: 'A test agent',
    url: 'https://example.com',
    version: '1.0.0',
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    capabilities: {
      streaming: true,
      pushNotifications: false,
    },
    skills: [],
    ...overrides,
  };
}

describe('AGENT_CARD_PATH', () => {
  it('should be the well-known path', () => {
    expect(AGENT_CARD_PATH).toBe('/.well-known/agent.json');
  });
});

describe('validateAgentCard', () => {
  describe('valid cards', () => {
    it('should accept a minimal valid card', () => {
      const card = createValidCard();
      expect(validateAgentCard(card)).toBe(true);
    });

    it('should accept a card with skills', () => {
      const card = createValidCard({
        skills: [
          {
            id: 'skill-1',
            name: 'Skill One',
            description: 'First skill',
          },
        ],
      });
      expect(validateAgentCard(card)).toBe(true);
    });

    it('should accept a card with multiple input/output modes', () => {
      const card = createValidCard({
        defaultInputModes: ['text', 'image', 'audio'],
        defaultOutputModes: ['text', 'image'],
      });
      expect(validateAgentCard(card)).toBe(true);
    });

    it('should accept a card with all capabilities', () => {
      const card = createValidCard({
        capabilities: {
          streaming: true,
          pushNotifications: true,
          stateTransitionHistory: true,
        },
      });
      expect(validateAgentCard(card)).toBe(true);
    });
  });

  describe('invalid cards', () => {
    it('should reject null', () => {
      expect(validateAgentCard(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(validateAgentCard(undefined)).toBe(false);
    });

    it('should reject non-objects', () => {
      expect(validateAgentCard('string')).toBe(false);
      expect(validateAgentCard(123)).toBe(false);
      expect(validateAgentCard(true)).toBe(false);
      expect(validateAgentCard([])).toBe(false);
    });

    it('should reject missing name', () => {
      const { name, ...card } = createValidCard();
      expect(validateAgentCard(card)).toBe(false);
    });

    it('should reject empty name', () => {
      const card = createValidCard({ name: '' });
      expect(validateAgentCard(card)).toBe(false);
    });

    it('should reject missing description', () => {
      const { description, ...card } = createValidCard();
      expect(validateAgentCard(card)).toBe(false);
    });

    it('should reject empty description', () => {
      const card = createValidCard({ description: '' });
      expect(validateAgentCard(card)).toBe(false);
    });

    it('should reject missing url', () => {
      const { url, ...card } = createValidCard();
      expect(validateAgentCard(card)).toBe(false);
    });

    it('should reject empty url', () => {
      const card = createValidCard({ url: '' });
      expect(validateAgentCard(card)).toBe(false);
    });

    it('should reject missing version', () => {
      const { version, ...card } = createValidCard();
      expect(validateAgentCard(card)).toBe(false);
    });

    it('should reject empty version', () => {
      const card = createValidCard({ version: '' });
      expect(validateAgentCard(card)).toBe(false);
    });

    it('should reject missing defaultInputModes', () => {
      const { defaultInputModes, ...card } = createValidCard();
      expect(validateAgentCard(card)).toBe(false);
    });

    it('should reject empty defaultInputModes array', () => {
      const card = createValidCard({ defaultInputModes: [] });
      expect(validateAgentCard(card)).toBe(false);
    });

    it('should reject non-array defaultInputModes', () => {
      const card = { ...createValidCard(), defaultInputModes: 'text' };
      expect(validateAgentCard(card)).toBe(false);
    });

    it('should reject missing defaultOutputModes', () => {
      const { defaultOutputModes, ...card } = createValidCard();
      expect(validateAgentCard(card)).toBe(false);
    });

    it('should reject empty defaultOutputModes array', () => {
      const card = createValidCard({ defaultOutputModes: [] });
      expect(validateAgentCard(card)).toBe(false);
    });

    it('should reject missing skills array', () => {
      const { skills, ...card } = createValidCard();
      expect(validateAgentCard(card)).toBe(false);
    });

    it('should reject non-array skills', () => {
      const card = { ...createValidCard(), skills: {} };
      expect(validateAgentCard(card)).toBe(false);
    });

    it('should reject missing capabilities', () => {
      const { capabilities, ...card } = createValidCard();
      expect(validateAgentCard(card)).toBe(false);
    });

    it('should reject non-object capabilities', () => {
      const card = { ...createValidCard(), capabilities: 'streaming' };
      expect(validateAgentCard(card)).toBe(false);
    });
  });
});

describe('parseAgentCard', () => {
  it('should return valid card', () => {
    const card = createValidCard();
    const result = parseAgentCard(card);
    expect(result).toEqual(card);
  });

  it('should throw ValidationError for invalid card', () => {
    expect(() => parseAgentCard(null)).toThrow(ValidationError);
    expect(() => parseAgentCard({})).toThrow(ValidationError);
    expect(() => parseAgentCard({ name: 'incomplete' })).toThrow(ValidationError);
  });

  it('should throw with correct message', () => {
    try {
      parseAgentCard({});
      expect(true).toBe(false); // Should not reach
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).message).toBe('Invalid Agent Card structure');
    }
  });
});

describe('createMinimalAgentCard', () => {
  it('should create a valid card with required fields', () => {
    const card = createMinimalAgentCard(
      'my-agent',
      'My description',
      'https://example.com'
    );

    expect(card.name).toBe('my-agent');
    expect(card.description).toBe('My description');
    expect(card.url).toBe('https://example.com');
  });

  it('should set default version to 1.0.0', () => {
    const card = createMinimalAgentCard('agent', 'desc', 'https://x.com');
    expect(card.version).toBe('1.0.0');
  });

  it('should set default input/output modes to text', () => {
    const card = createMinimalAgentCard('agent', 'desc', 'https://x.com');
    expect(card.defaultInputModes).toEqual(['text']);
    expect(card.defaultOutputModes).toEqual(['text']);
  });

  it('should set streaming to false by default', () => {
    const card = createMinimalAgentCard('agent', 'desc', 'https://x.com');
    expect(card.capabilities.streaming).toBe(false);
  });

  it('should set pushNotifications to false by default', () => {
    const card = createMinimalAgentCard('agent', 'desc', 'https://x.com');
    expect(card.capabilities.pushNotifications).toBe(false);
  });

  it('should have empty skills array', () => {
    const card = createMinimalAgentCard('agent', 'desc', 'https://x.com');
    expect(card.skills).toEqual([]);
  });

  it('should create a valid card according to validator', () => {
    const card = createMinimalAgentCard('agent', 'desc', 'https://x.com');
    expect(validateAgentCard(card)).toBe(true);
  });
});

describe('withSkills', () => {
  it('should add skills to empty skills array', () => {
    const card = createValidCard({ skills: [] });
    const skills: Skill[] = [
      { id: 'skill-1', name: 'Skill 1', description: 'First' },
    ];

    const result = withSkills(card, skills);

    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].id).toBe('skill-1');
  });

  it('should append skills to existing skills', () => {
    const existingSkill: Skill = { id: 'existing', name: 'Existing', description: 'Already there' };
    const card = createValidCard({ skills: [existingSkill] });
    const newSkills: Skill[] = [
      { id: 'new-1', name: 'New 1', description: 'New skill' },
    ];

    const result = withSkills(card, newSkills);

    expect(result.skills).toHaveLength(2);
    expect(result.skills[0].id).toBe('existing');
    expect(result.skills[1].id).toBe('new-1');
  });

  it('should not modify original card', () => {
    const card = createValidCard({ skills: [] });
    const skills: Skill[] = [
      { id: 'skill-1', name: 'Skill 1', description: 'First' },
    ];

    withSkills(card, skills);

    expect(card.skills).toHaveLength(0);
  });

  it('should handle multiple skills at once', () => {
    const card = createValidCard({ skills: [] });
    const skills: Skill[] = [
      { id: 's1', name: 'S1', description: 'D1' },
      { id: 's2', name: 'S2', description: 'D2' },
      { id: 's3', name: 'S3', description: 'D3' },
    ];

    const result = withSkills(card, skills);

    expect(result.skills).toHaveLength(3);
  });
});

describe('withCapabilities', () => {
  it('should update streaming capability', () => {
    const card = createValidCard({
      capabilities: { streaming: false, pushNotifications: false },
    });

    const result = withCapabilities(card, { streaming: true });

    expect(result.capabilities.streaming).toBe(true);
    expect(result.capabilities.pushNotifications).toBe(false);
  });

  it('should update pushNotifications capability', () => {
    const card = createValidCard({
      capabilities: { streaming: false, pushNotifications: false },
    });

    const result = withCapabilities(card, { pushNotifications: true });

    expect(result.capabilities.pushNotifications).toBe(true);
  });

  it('should add stateTransitionHistory capability', () => {
    const card = createValidCard({
      capabilities: { streaming: false, pushNotifications: false },
    });

    const result = withCapabilities(card, { stateTransitionHistory: true });

    expect(result.capabilities.stateTransitionHistory).toBe(true);
  });

  it('should update multiple capabilities at once', () => {
    const card = createValidCard({
      capabilities: { streaming: false, pushNotifications: false },
    });

    const result = withCapabilities(card, {
      streaming: true,
      pushNotifications: true,
      stateTransitionHistory: true,
    });

    expect(result.capabilities.streaming).toBe(true);
    expect(result.capabilities.pushNotifications).toBe(true);
    expect(result.capabilities.stateTransitionHistory).toBe(true);
  });

  it('should not modify original card', () => {
    const card = createValidCard({
      capabilities: { streaming: false, pushNotifications: false },
    });

    withCapabilities(card, { streaming: true });

    expect(card.capabilities.streaming).toBe(false);
  });
});

describe('getAgentCardUrl', () => {
  it('should append well-known path to base URL', () => {
    const url = getAgentCardUrl('https://example.com');
    expect(url).toBe('https://example.com/.well-known/agent.json');
  });

  it('should handle URL with trailing slash', () => {
    const url = getAgentCardUrl('https://example.com/');
    expect(url).toBe('https://example.com/.well-known/agent.json');
  });

  it('should replace existing path', () => {
    const url = getAgentCardUrl('https://example.com/api/v1');
    expect(url).toBe('https://example.com/.well-known/agent.json');
  });

  it('should preserve port', () => {
    const url = getAgentCardUrl('https://example.com:8080');
    expect(url).toBe('https://example.com:8080/.well-known/agent.json');
  });

  it('should handle localhost', () => {
    const url = getAgentCardUrl('http://localhost:3000');
    expect(url).toBe('http://localhost:3000/.well-known/agent.json');
  });
});

describe('findSkill', () => {
  const skills: Skill[] = [
    { id: 'chat', name: 'Chat', description: 'General chat' },
    { id: 'translate', name: 'Translate', description: 'Translation' },
    { id: 'summarize', name: 'Summarize', description: 'Summarization' },
  ];
  const card = createValidCard({ skills });

  it('should find existing skill by id', () => {
    const skill = findSkill(card, 'translate');
    expect(skill).toBeDefined();
    expect(skill?.name).toBe('Translate');
  });

  it('should return undefined for non-existent skill', () => {
    const skill = findSkill(card, 'nonexistent');
    expect(skill).toBeUndefined();
  });

  it('should return first skill if multiple with same id', () => {
    const duplicateCard = createValidCard({
      skills: [
        { id: 'dup', name: 'First', description: 'First one' },
        { id: 'dup', name: 'Second', description: 'Second one' },
      ],
    });
    const skill = findSkill(duplicateCard, 'dup');
    expect(skill?.name).toBe('First');
  });

  it('should work with empty skills array', () => {
    const emptyCard = createValidCard({ skills: [] });
    const skill = findSkill(emptyCard, 'any');
    expect(skill).toBeUndefined();
  });
});

describe('hasCapability', () => {
  it('should return true for enabled capability', () => {
    const card = createValidCard({
      capabilities: { streaming: true, pushNotifications: false },
    });
    expect(hasCapability(card, 'streaming')).toBe(true);
  });

  it('should return false for disabled capability', () => {
    const card = createValidCard({
      capabilities: { streaming: false, pushNotifications: false },
    });
    expect(hasCapability(card, 'streaming')).toBe(false);
  });

  it('should return false for undefined optional capability', () => {
    const card = createValidCard({
      capabilities: { streaming: true, pushNotifications: false },
    });
    expect(hasCapability(card, 'stateTransitionHistory')).toBe(false);
  });

  it('should return true for enabled optional capability', () => {
    const card = createValidCard({
      capabilities: { streaming: true, pushNotifications: false, stateTransitionHistory: true },
    });
    expect(hasCapability(card, 'stateTransitionHistory')).toBe(true);
  });
});

describe('getSkillIds', () => {
  it('should return array of skill IDs', () => {
    const card = createValidCard({
      skills: [
        { id: 'a', name: 'A', description: 'Skill A' },
        { id: 'b', name: 'B', description: 'Skill B' },
        { id: 'c', name: 'C', description: 'Skill C' },
      ],
    });

    const ids = getSkillIds(card);

    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('should return empty array for no skills', () => {
    const card = createValidCard({ skills: [] });
    expect(getSkillIds(card)).toEqual([]);
  });

  it('should preserve order', () => {
    const card = createValidCard({
      skills: [
        { id: 'z', name: 'Z', description: 'Last' },
        { id: 'a', name: 'A', description: 'First' },
        { id: 'm', name: 'M', description: 'Middle' },
      ],
    });

    expect(getSkillIds(card)).toEqual(['z', 'a', 'm']);
  });
});

describe('supportsInputMode', () => {
  const card = createValidCard({
    defaultInputModes: ['text', 'image'],
    skills: [
      {
        id: 'audio-skill',
        name: 'Audio',
        description: 'Audio processing',
        inputModes: ['audio'],
      },
      {
        id: 'multi-skill',
        name: 'Multi',
        description: 'Multi-mode',
        inputModes: ['text', 'image', 'audio'],
      },
      {
        id: 'default-skill',
        name: 'Default',
        description: 'Uses defaults',
        // No inputModes specified
      },
    ],
  });

  it('should check default modes when no skillId provided', () => {
    expect(supportsInputMode(card, 'text')).toBe(true);
    expect(supportsInputMode(card, 'image')).toBe(true);
    expect(supportsInputMode(card, 'audio')).toBe(false);
  });

  it('should check skill-specific modes when skillId provided', () => {
    expect(supportsInputMode(card, 'audio', 'audio-skill')).toBe(true);
    expect(supportsInputMode(card, 'text', 'audio-skill')).toBe(false);
  });

  it('should fall back to defaults when skill has no inputModes', () => {
    expect(supportsInputMode(card, 'text', 'default-skill')).toBe(true);
    expect(supportsInputMode(card, 'audio', 'default-skill')).toBe(false);
  });

  it('should fall back to defaults when skill not found', () => {
    expect(supportsInputMode(card, 'text', 'nonexistent')).toBe(true);
    expect(supportsInputMode(card, 'audio', 'nonexistent')).toBe(false);
  });

  it('should check multi-mode skill correctly', () => {
    expect(supportsInputMode(card, 'text', 'multi-skill')).toBe(true);
    expect(supportsInputMode(card, 'image', 'multi-skill')).toBe(true);
    expect(supportsInputMode(card, 'audio', 'multi-skill')).toBe(true);
    expect(supportsInputMode(card, 'video', 'multi-skill')).toBe(false);
  });
});

describe('supportsOutputMode', () => {
  const card = createValidCard({
    defaultOutputModes: ['text'],
    skills: [
      {
        id: 'image-gen',
        name: 'Image Gen',
        description: 'Generates images',
        outputModes: ['image'],
      },
      {
        id: 'multi-out',
        name: 'Multi Output',
        description: 'Multiple outputs',
        outputModes: ['text', 'image', 'audio'],
      },
      {
        id: 'default-out',
        name: 'Default Output',
        description: 'Uses defaults',
        // No outputModes specified
      },
    ],
  });

  it('should check default modes when no skillId provided', () => {
    expect(supportsOutputMode(card, 'text')).toBe(true);
    expect(supportsOutputMode(card, 'image')).toBe(false);
  });

  it('should check skill-specific modes when skillId provided', () => {
    expect(supportsOutputMode(card, 'image', 'image-gen')).toBe(true);
    expect(supportsOutputMode(card, 'text', 'image-gen')).toBe(false);
  });

  it('should fall back to defaults when skill has no outputModes', () => {
    expect(supportsOutputMode(card, 'text', 'default-out')).toBe(true);
    expect(supportsOutputMode(card, 'image', 'default-out')).toBe(false);
  });

  it('should fall back to defaults when skill not found', () => {
    expect(supportsOutputMode(card, 'text', 'nonexistent')).toBe(true);
  });

  it('should check multi-mode skill correctly', () => {
    expect(supportsOutputMode(card, 'text', 'multi-out')).toBe(true);
    expect(supportsOutputMode(card, 'image', 'multi-out')).toBe(true);
    expect(supportsOutputMode(card, 'audio', 'multi-out')).toBe(true);
    expect(supportsOutputMode(card, 'video', 'multi-out')).toBe(false);
  });
});
