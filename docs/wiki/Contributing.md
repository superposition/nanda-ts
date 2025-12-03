# Contributing

Thank you for your interest in contributing to NANDA-TS! This guide will help you get started.

## Getting Started

### Prerequisites

- **Bun** >= 1.1.0 ([Install Bun](https://bun.sh))
- **Git**
- **Node.js** >= 18 (for some tooling)

### Setup

1. **Fork the repository**

   Click the "Fork" button on GitHub.

2. **Clone your fork**

   ```bash
   git clone https://github.com/YOUR-USERNAME/nanda-ts.git
   cd nanda-ts
   ```

3. **Install dependencies**

   ```bash
   bun install
   ```

4. **Create a branch**

   ```bash
   git checkout -b feature/my-feature
   ```

---

## Development

### Running Locally

```bash
# Run examples
bun run examples/basic-server.ts

# Run in watch mode
bun run --watch examples/basic-server.ts
```

### Code Quality

```bash
# Type checking
bun run typecheck

# Linting
bun run lint

# Formatting
bun run format

# All checks
bun run check
```

### Testing

```bash
# Run all tests
bun test

# Run specific tests
bun test src/protocols/a2a

# Watch mode
bun test --watch

# Coverage
bun test --coverage
```

---

## Project Structure

```
nanda-ts/
├── src/
│   ├── protocols/          # Protocol implementations
│   │   ├── a2a/           # A2A protocol
│   │   ├── mcp/           # MCP bridge
│   │   └── nlweb/         # NLWeb client
│   ├── server/            # Agent server
│   ├── registry/          # Registry client
│   ├── agent/             # Identity & facts
│   ├── crypto/            # Cryptography
│   ├── client/            # High-level client
│   └── types/             # TypeScript types
├── cli/                   # CLI tool
├── examples/              # Usage examples
├── tests/                 # Test suite
│   ├── unit/
│   └── integration/
└── docs/                  # Documentation
```

---

## Making Changes

### Code Style

- **TypeScript** - All code must be TypeScript
- **No dependencies** - Use only Bun-native APIs
- **Formatting** - Use Prettier (runs on commit)
- **Linting** - ESLint with strict rules

### Naming Conventions

```typescript
// Classes: PascalCase
class AgentServer {}

// Functions/methods: camelCase
function createIndexClient() {}

// Constants: UPPER_SNAKE_CASE
const DEFAULT_PORT = 3000;

// Types/Interfaces: PascalCase
interface AgentCard {}
type TaskState = 'SUBMITTED' | 'WORKING';

// Files: kebab-case or PascalCase for classes
// agent-server.ts or AgentServer.ts
```

### Documentation

- Add JSDoc comments to public APIs
- Update wiki if adding new features
- Include code examples

```typescript
/**
 * Creates a new A2A client for communicating with agents.
 *
 * @param config - Client configuration
 * @returns A configured A2AClient instance
 *
 * @example
 * ```typescript
 * const client = new A2AClient({
 *   agentUrl: 'http://localhost:3000',
 * });
 * ```
 */
export class A2AClient {
  // ...
}
```

---

## Pull Requests

### Before Submitting

1. **Run all checks**
   ```bash
   bun run check
   bun test
   ```

2. **Update documentation** if needed

3. **Add tests** for new features

4. **Keep commits focused** - One logical change per commit

### PR Title Format

Use conventional commits:

```
feat: add streaming support to NLWeb client
fix: resolve cache invalidation issue
docs: update API reference for AgentServer
test: add integration tests for registry
refactor: simplify task state management
chore: update dependencies
```

### PR Description Template

```markdown
## Summary
Brief description of changes.

## Changes
- Added X
- Fixed Y
- Updated Z

## Testing
How was this tested?

## Related Issues
Fixes #123
```

---

## Types of Contributions

### Bug Fixes

1. Create an issue first (if one doesn't exist)
2. Reference the issue in your PR
3. Include a test that reproduces the bug

### New Features

1. Open an issue to discuss the feature
2. Wait for approval before implementing
3. Include tests and documentation

### Documentation

- Fix typos and improve clarity
- Add examples
- Update wiki pages

### Tests

- Improve test coverage
- Add edge case tests
- Add integration tests

---

## Issue Guidelines

### Bug Reports

Include:
- NANDA-TS version
- Bun version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Error messages/stack traces

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternative solutions considered
- Willingness to implement

---

## Code Review

### What We Look For

- **Correctness** - Does it work as intended?
- **Tests** - Are there adequate tests?
- **Documentation** - Is it documented?
- **Performance** - Any performance concerns?
- **Security** - Any security implications?
- **Style** - Does it follow conventions?

### Response Times

We aim to respond to PRs within:
- Initial review: 2-3 business days
- Follow-up reviews: 1-2 business days

---

## Release Process

1. Version bump in `package.json`
2. Update `CHANGELOG.md`
3. Create release PR
4. Merge to main
5. Tag release
6. Publish to npm

---

## Community

### Code of Conduct

Be respectful and inclusive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).

### Getting Help

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and ideas
- **Discord** - Real-time chat (if available)

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Recognition

Contributors are recognized in:
- `CONTRIBUTORS.md`
- Release notes
- Project README

Thank you for contributing!
