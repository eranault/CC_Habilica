# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install client deps and build
COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
RUN cd client && npm run build

# ---- Production stage ----
FROM node:20-alpine AS production

WORKDIR /app

# Install server deps only
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server/ ./server/
COPY --from=builder /app/client/dist ./client/dist

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/streakr.db

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "server/index.js"]
