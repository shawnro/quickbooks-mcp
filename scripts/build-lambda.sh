#\!/bin/bash
# Build and package the Lambda deployment artifact
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "Building Lambda bundle..."
npm run build:lambda

echo "Packaging zip..."
mkdir -p deploy
cd dist-lambda
zip -j ../deploy/qb-mcp.zip handler.mjs
cd ..

echo "Done: deploy/qb-mcp.zip ($(du -h deploy/qb-mcp.zip | cut -f1))"
