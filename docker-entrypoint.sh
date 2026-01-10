#!/bin/sh
set -e

# Install/update dependencies (fast if already installed)
echo "Installing dependencies..."
pnpm install

# Execute the command passed to the container
exec "$@"
