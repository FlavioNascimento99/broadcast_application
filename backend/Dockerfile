# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Runtime
FROM node:18-alpine

# Prisma's query engine needs OpenSSL, which isn't in the base Alpine image
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files and Prisma schema before installing, so the
# @prisma/client postinstall hook can generate the client
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install only production dependencies
RUN npm ci --only=production

# Copy built app from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Push Prisma schema to the database, then start app
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
