# ── Stage 1: Instalar dependencias ─────────────────────────────────────
# Solo package.json → capa de caché estable. Solo se re-ejecuta si
# package.json o package-lock.json cambian.
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ── Stage 2: Development ────────────────────────────────────────────────
# Arranque mínimo: solo node_modules copiados, código llega via bind-mount.
# El named volume next_cache/.next/ preserva el caché de TurboPack entre
# reinicios del stack — esto es lo que hace el arranque en ~5s.
FROM node:20-alpine AS development
WORKDIR /app

# Copiar dependencies instaladas desde la etapa deps
COPY --from=deps /app/node_modules ./node_modules

# NO copiamos el código fuente aquí.
# El bind-mount en docker-compose.yml lo provee en tiempo de ejecución.
# El named volume sobreescribirá .next/ para preservar el caché.

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# El CMD se sobreescribe en docker-compose.yml pero se define por claridad
CMD ["npm", "run", "dev"]

# ── Stage 3: Builder (para producción) ─────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=3584"

RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ── Stage 4: Runner (para producción) ──────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app-standalone

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

RUN mkdir .next && chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Robust fix para nested standalone output
RUN if [ ! -f "./server.js" ]; then \
    NESTED_DIR=$(find . -maxdepth 2 -name server.js -exec dirname {} \;) ; \
    if [ -n "$NESTED_DIR" ] && [ "$NESTED_DIR" != "." ]; then \
    cp -r "$NESTED_DIR"/. . && rm -rf "$NESTED_DIR"; \
    fi; \
    fi

RUN if [ ! -f "./server.js" ]; then \
    echo "CRITICAL: server.js missing after all checks"; ls -R; exit 1; \
    fi

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
