/**
 * Init Command
 *
 * Scaffolds a new NANDA agent project.
 */

import { BASIC_AGENT_TEMPLATE } from './templates/basic-agent';

interface ProjectFiles {
  [path: string]: string;
}

/**
 * Initialize a new NANDA agent project
 */
export async function init(args: string[]): Promise<void> {
  const projectName = args[0] || 'my-nanda-agent';
  const projectDir = `./${projectName}`;

  console.log(`Creating new NANDA agent: ${projectName}`);

  // Check if directory already exists
  const exists = await Bun.file(projectDir).exists();
  if (exists) {
    console.error(`Error: Directory ${projectDir} already exists`);
    process.exit(1);
  }

  // Create project structure
  const files = generateProjectFiles(projectName);

  for (const [path, content] of Object.entries(files)) {
    const fullPath = `${projectDir}/${path}`;
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));

    // Create directory if needed
    if (dir !== projectDir) {
      await Bun.spawn(['mkdir', '-p', dir]).exited;
    }

    // Write file
    await Bun.write(fullPath, content);
    console.log(`  Created ${path}`);
  }

  console.log(`
Project created successfully!

Next steps:
  cd ${projectName}
  bun install
  bun run dev

Your agent will be running at http://localhost:3000
`);
}

/**
 * Generate project files
 */
function generateProjectFiles(projectName: string): ProjectFiles {
  const safeName = projectName.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

  return {
    'package.json': JSON.stringify(
      {
        name: safeName,
        version: '0.1.0',
        description: `A NANDA agent: ${projectName}`,
        type: 'module',
        main: 'src/index.ts',
        scripts: {
          dev: 'bun run --watch src/index.ts',
          start: 'bun run src/index.ts',
          build: 'bun build src/index.ts --outdir dist --target bun',
          typecheck: 'tsc --noEmit',
        },
        dependencies: {
          'nanda-ts': '^0.1.0',
        },
        devDependencies: {
          '@types/bun': '^1.1.0',
          typescript: '^5.0.0',
        },
      },
      null,
      2
    ),

    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          declaration: true,
          outDir: './dist',
          rootDir: './src',
          types: ['bun-types'],
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist'],
      },
      null,
      2
    ),

    '.gitignore': `# Dependencies
node_modules/

# Build
dist/

# Environment
.env
.env.local

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
`,

    'src/index.ts': BASIC_AGENT_TEMPLATE.replace('{{PROJECT_NAME}}', projectName).replace(
      '{{SAFE_NAME}}',
      safeName
    ),

    'src/handlers/echo.ts': `/**
 * Echo Handler
 *
 * Simple handler that echoes back the received message.
 */

import type { MessageSendParams, Task } from 'nanda-ts';

export async function handleEcho(params: MessageSendParams): Promise<Task> {
  const message = params.message;
  const textPart = message.parts.find((p) => p.type === 'text');
  const text = textPart?.type === 'text' ? textPart.text : '';

  return {
    id: crypto.randomUUID(),
    contextId: params.contextId || crypto.randomUUID(),
    state: 'COMPLETED',
    message: {
      role: 'agent',
      parts: [
        {
          type: 'text',
          text: \`Echo: \${text}\`,
        },
      ],
    },
    artifacts: [],
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
`,

    'README.md': `# ${projectName}

A NANDA agent built with nanda-ts.

## Getting Started

\`\`\`bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Build for production
bun run build
\`\`\`

## Agent Card

Your agent's card is available at:
- \`http://localhost:3000/.well-known/agent.json\`

## API Endpoints

- \`POST /rpc\` - JSON-RPC 2.0 endpoint for A2A protocol
- \`GET /health\` - Health check endpoint

## Development

Edit \`src/index.ts\` to customize your agent's behavior.

## Resources

- [NANDA Protocol](https://github.com/nanda-ai)
- [A2A Protocol](https://google.github.io/a2a)
- [nanda-ts Documentation](https://github.com/nanda-ai/nanda-ts)
`,
  };
}
