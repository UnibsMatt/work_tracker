# ---- deps: install packages (build tools needed for better-sqlite3) ----
FROM node:22-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

# ---- build ----
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- run ----
FROM node:22-alpine AS runner
RUN apk add --no-cache tzdata
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DB_PATH=/app/data/shifts.db
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN mkdir -p /app/data
VOLUME /app/data
EXPOSE 3000
CMD ["node", "server.js"]
