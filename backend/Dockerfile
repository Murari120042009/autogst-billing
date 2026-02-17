# 🐳 NODE.JS BACKEND & WORKER DOCKERFILE

# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Install ALL dependencies (including devDeps for build)
RUN npm ci
COPY . .
# Build TypeScript
RUN npm run build
# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install system dependencies if needed (e.g. for specific node modules)
# RUN apk add --no-cache curl

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# User Safety
USER node

# Healthcheck (Basic TCP check)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD nc -z localhost 4000 || exit 1

CMD ["node", "dist/index.js"]
