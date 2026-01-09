FROM node:22-slim

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./

# Copy all packages
COPY packages ./packages

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build all packages
RUN pnpm build

# Set working directory to runner
WORKDIR /app/packages/runner

# Run the service
CMD ["pnpm", "start"]
