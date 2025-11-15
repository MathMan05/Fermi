# Multi-stage build for Fermi Client
# Stage 1: Builder
FROM node:18-bullseye AS builder

# Build argument for version/git commit hash
ARG VER=unknown

WORKDIR /build

# Install build dependencies
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y build-essential && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install --production && \
    npm cache clean --force

# Copy source code
COPY . .

# Set VER environment variable for build script
ENV VER=${VER}

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

LABEL maintainer="MathMan05"
LABEL description="Fermi Client - A Spacebar Client"
LABEL version="0.2.0"

# Install Node.js and npm (already included in node:20-alpine)
# RUN apk add --no-cache --update nodejs npm

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package*.json ./

# Create non-root user for security
RUN adduser -D fermi && \
    chown -R fermi:fermi /app

# Switch to non-root user
USER fermi

# Expose application port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/uptime', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["npm", "start"]
