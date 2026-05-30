# ---- Stage 1: Dependencies ----
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

# ---- Stage 2: Production ----
FROM node:20-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

# Pre-create the logs dir so Winston (non-root) can write to it
RUN mkdir -p logs && chown -R appuser:appgroup logs

USER appuser

EXPOSE 3000

CMD ["node", "src/server.js"]
