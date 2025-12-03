/**
 * A2A Protocol exports
 */

export { A2AClient, createA2AClient, type A2AClientConfig } from './A2AClient';

export {
  SSEParser,
  parseSSEStream,
  createSSEResponse,
  type SSEEvent,
} from './streaming';

export {
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
} from './AgentCard';
