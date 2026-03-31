#!/usr/bin/env bash
# setup.sh — One-shot project setup for new contributors
set -euo pipefail

echo "================================================"
echo "  Critical Context Extractor — Setup"
echo "================================================"

# Check required tools
check_command() {
  if ! command -v "$1" &>/dev/null; then
    echo "❌  $1 is required but not installed. Aborting."
    exit 1
  fi
}

check_command node
check_command npm

NODE_VERSION=$(node --version | grep -oP '\d+' | head -1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌  Node.js >= 18 required (current: $(node --version))"
  exit 1
fi

echo "✅  Node.js $(node --version)"

# Install dependencies
echo ""
echo "📦  Installing dependencies..."
npm install

# Copy env if missing
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "📋  Created .env from .env.example"
  echo "⚠️   Please edit .env and set your GEMINI_API_KEY before starting."
else
  echo "✅  .env already exists"
fi

# Generate test fixtures
echo ""
echo "🧪  Generating test fixtures..."
npx ts-node src/scripts/test-data-generator.ts 5 || echo "⚠️  Fixture generation skipped (needs ts-node)"

# Run tests
echo ""
echo "🔬  Running tests..."
npm test

echo ""
echo "================================================"
echo "  Setup complete! Next steps:"
echo "  1. Edit .env — add GEMINI_API_KEY"
echo "  2. npm run dev    (start MCP server)"
echo "  3. ngrok http 3000"
echo "  4. Register <ngrok-url>/mcp in Prompt Opinion"
echo "================================================"
