/**
 * Tests for types/agent.ts
 */

import { describe, it, expect } from 'bun:test';
import { createAgentCard, type AgentConfig } from '../../src/types/agent';

describe('createAgentCard', () => {
  const baseConfig: AgentConfig = {
    name: 'test-agent',
    description: 'A test agent for testing',
  };

  it('should create an AgentCard with required fields', () => {
    const card = createAgentCard(baseConfig, 'https://example.com');

    expect(card.name).toBe('test-agent');
    expect(card.description).toBe('A test agent for testing');
    expect(card.url).toBe('https://example.com');
  });

  it('should use default version 1.0.0 when not specified', () => {
    const card = createAgentCard(baseConfig, 'https://example.com');

    expect(card.version).toBe('1.0.0');
  });

  it('should use provided version', () => {
    const config = { ...baseConfig, version: '2.5.0' };
    const card = createAgentCard(config, 'https://example.com');

    expect(card.version).toBe('2.5.0');
  });

  it('should set default input/output modes to text', () => {
    const card = createAgentCard(baseConfig, 'https://example.com');

    expect(card.defaultInputModes).toEqual(['text']);
    expect(card.defaultOutputModes).toEqual(['text']);
  });

  it('should set default capabilities', () => {
    const card = createAgentCard(baseConfig, 'https://example.com');

    expect(card.capabilities.streaming).toBe(true);
    expect(card.capabilities.pushNotifications).toBe(false);
    expect(card.capabilities.stateTransitionHistory).toBe(false);
  });

  it('should use provided capabilities', () => {
    const config: AgentConfig = {
      ...baseConfig,
      capabilities: {
        streaming: false,
        pushNotifications: true,
        stateTransitionHistory: true,
      },
    };
    const card = createAgentCard(config, 'https://example.com');

    expect(card.capabilities.streaming).toBe(false);
    expect(card.capabilities.pushNotifications).toBe(true);
    expect(card.capabilities.stateTransitionHistory).toBe(true);
  });

  it('should handle partial capabilities', () => {
    const config: AgentConfig = {
      ...baseConfig,
      capabilities: {
        pushNotifications: true,
      },
    };
    const card = createAgentCard(config, 'https://example.com');

    expect(card.capabilities.streaming).toBe(true); // default
    expect(card.capabilities.pushNotifications).toBe(true); // provided
    expect(card.capabilities.stateTransitionHistory).toBe(false); // default
  });

  it('should use empty skills array when not provided', () => {
    const card = createAgentCard(baseConfig, 'https://example.com');

    expect(card.skills).toEqual([]);
  });

  it('should use provided skills', () => {
    const config: AgentConfig = {
      ...baseConfig,
      skills: [
        {
          id: 'skill-1',
          name: 'Test Skill',
          description: 'A test skill',
        },
      ],
    };
    const card = createAgentCard(config, 'https://example.com');

    expect(card.skills.length).toBe(1);
    expect(card.skills[0].id).toBe('skill-1');
    expect(card.skills[0].name).toBe('Test Skill');
  });

  it('should include provider when specified', () => {
    const config: AgentConfig = {
      ...baseConfig,
      provider: {
        organization: 'Test Org',
        url: 'https://testorg.com',
      },
    };
    const card = createAgentCard(config, 'https://example.com');

    expect(card.provider).toBeDefined();
    expect(card.provider?.organization).toBe('Test Org');
    expect(card.provider?.url).toBe('https://testorg.com');
  });

  it('should not include provider when not specified', () => {
    const card = createAgentCard(baseConfig, 'https://example.com');

    expect(card.provider).toBeUndefined();
  });
});
