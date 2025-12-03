#!/bin/bash
# Run integration tests separately with reduced concurrency
# These tests require network servers and can have port conflicts when run in parallel

set -e

echo "Running integration tests..."
bun test tests/integration --max-concurrency=1

echo "Integration tests completed successfully!"
