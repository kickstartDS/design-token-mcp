# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Production stage
FROM node:20-alpine AS production

# Add labels for container metadata
LABEL org.opencontainers.image.source="https://github.com/kickstartDS/design-token-mcp"
LABEL org.opencontainers.image.description="MCP server for managing design tokens"
LABEL org.opencontainers.image.version="3.0.0"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY package*.json ./
COPY index.js ./
COPY tokens/ ./tokens/

# Set ownership to non-root user
RUN chown -R nodejs:nodejs /app

USER nodejs

# Environment variables
ENV NODE_ENV=production

# Health check - MCP servers communicate via stdio, so we check if process can start
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('./index.js')" || exit 1

# MCP servers use stdio for communication
CMD ["node", "index.js"]
