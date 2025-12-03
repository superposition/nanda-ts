/**
 * Basic Agent Template
 *
 * Template for new NANDA agent projects.
 */

export const BASIC_AGENT_TEMPLATE = `/**
 * {{PROJECT_NAME}} Agent
 *
 * A NANDA agent built with nanda-ts.
 */

import { AgentServer } from 'nanda-ts';
import { handleEcho } from './handlers/echo';

// Create the agent server
const server = new AgentServer({
  name: '{{SAFE_NAME}}',
  description: 'A NANDA agent: {{PROJECT_NAME}}',
  version: '0.1.0',
  provider: {
    organization: 'Your Organization',
  },
  port: 3000,
  skills: [
    {
      id: 'echo',
      name: 'Echo',
      description: 'Echoes back the message',
      tags: ['utility', 'demo'],
      inputModes: ['text'],
      outputModes: ['text'],
    },
  ],
});

// Register the message handler
server.onMessage(async (params, _ctx) => {
  // Route to appropriate handler based on message content
  // For now, just echo everything
  return handleEcho(params);
});

// Start the server
server.start().then(() => {
  console.log(\\\`
{{PROJECT_NAME}} agent is running!

Agent Card: http://localhost:3000/.well-known/agent.json
JSON-RPC:   http://localhost:3000/rpc
Health:     http://localhost:3000/health
  \\\`);
}).catch((error) => {
  console.error('Failed to start agent:', error);
  process.exit(1);
});
`;
