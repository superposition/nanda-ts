#!/usr/bin/env bun
/**
 * NANDA-TS CLI
 *
 * Command-line interface for managing NANDA agents.
 */

import { init } from './init';

const VERSION = '0.1.0';

interface Command {
  name: string;
  description: string;
  usage: string;
  handler: (args: string[]) => Promise<void>;
}

const commands: Command[] = [
  {
    name: 'init',
    description: 'Initialize a new NANDA agent project',
    usage: 'nanda-ts init [name]',
    handler: init,
  },
  {
    name: 'dev',
    description: 'Run agent in development mode',
    usage: 'nanda-ts dev [entry]',
    handler: async (args) => {
      const entry = args[0] || 'src/index.ts';
      console.log(`Starting development server with ${entry}...`);
      const proc = Bun.spawn(['bun', 'run', '--watch', entry], {
        stdio: ['inherit', 'inherit', 'inherit'],
      });
      await proc.exited;
    },
  },
  {
    name: 'register',
    description: 'Register agent with NANDA registry',
    usage: 'nanda-ts register <handle> <facts-url>',
    handler: async (args) => {
      if (args.length < 2) {
        console.error('Error: Missing required arguments');
        console.error('Usage: nanda-ts register <handle> <facts-url>');
        process.exit(1);
      }
      const [handle, factsUrl] = args;
      console.log(`Registering ${handle} with facts at ${factsUrl}...`);

      // Import dynamically to avoid loading everything for help
      const { createIndexClient } = await import('../src/registry/IndexClient');
      const client = createIndexClient();

      try {
        const result = await client.register(handle, factsUrl);
        console.log('Registration successful!');
        console.log(`  Handle: ${result.handle}`);
        console.log(`  Agent ID: ${result.agentId}`);
      } catch (error) {
        console.error('Registration failed:', error);
        process.exit(1);
      }
    },
  },
  {
    name: 'resolve',
    description: 'Resolve an agent handle',
    usage: 'nanda-ts resolve <handle>',
    handler: async (args) => {
      if (args.length < 1) {
        console.error('Error: Missing handle argument');
        console.error('Usage: nanda-ts resolve <handle>');
        process.exit(1);
      }
      const handle = args[0];
      console.log(`Resolving ${handle}...`);

      const { createIndexClient } = await import('../src/registry/IndexClient');
      const client = createIndexClient();

      try {
        const result = await client.resolve(handle);
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error('Resolution failed:', error);
        process.exit(1);
      }
    },
  },
  {
    name: 'search',
    description: 'Search for agents in the registry',
    usage: 'nanda-ts search <query>',
    handler: async (args) => {
      if (args.length < 1) {
        console.error('Error: Missing query argument');
        console.error('Usage: nanda-ts search <query>');
        process.exit(1);
      }
      const query = args.join(' ');
      console.log(`Searching for "${query}"...`);

      const { createIndexClient } = await import('../src/registry/IndexClient');
      const client = createIndexClient();

      try {
        const results = await client.search({ query });
        console.log(`Found ${results.length} agent(s):`);
        for (const agent of results) {
          console.log(`  - ${agent.handle}: ${agent.agentName}`);
          if (agent.description) {
            console.log(`    ${agent.description}`);
          }
        }
      } catch (error) {
        console.error('Search failed:', error);
        process.exit(1);
      }
    },
  },
];

function printHelp(): void {
  console.log(`
nanda-ts v${VERSION} - NANDA Agent SDK CLI

USAGE:
  nanda-ts <command> [options]

COMMANDS:
${commands.map((cmd) => `  ${cmd.name.padEnd(12)} ${cmd.description}`).join('\n')}
  help         Show this help message
  version      Show version

EXAMPLES:
  nanda-ts init my-agent       Create a new agent project
  nanda-ts dev                 Run agent in dev mode
  nanda-ts register my-agent https://example.com/facts.json

For more information, visit: https://github.com/nanda-ai/nanda-ts
`);
}

function printVersion(): void {
  console.log(`nanda-ts v${VERSION}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    return;
  }

  if (args[0] === 'version' || args[0] === '--version' || args[0] === '-v') {
    printVersion();
    return;
  }

  const commandName = args[0];
  const command = commands.find((cmd) => cmd.name === commandName);

  if (!command) {
    console.error(`Unknown command: ${commandName}`);
    console.error('Run "nanda-ts help" for available commands');
    process.exit(1);
  }

  try {
    await command.handler(args.slice(1));
  } catch (error) {
    console.error(`Error running ${commandName}:`, error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
