# Stage 1: Build stage
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Generate Prisma Client & Build TypeScript
RUN npx prisma generate
RUN npm run build

# Stage 2: Production runner stage
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

# Copy production dependencies and build artifacts
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate

COPY --chown=node:node --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --chown=node:node --from=builder /app/dist ./dist

EXPOSE 5000

ENV NODE_ENV=production
ENV NPM_CONFIG_CACHE=/tmp/.npm

USER node

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
