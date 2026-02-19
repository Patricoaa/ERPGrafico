# 1. Install dependencies only when needed
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
# Use cache mount for npm to speed up dependency installation
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Development stage
FROM node:20-alpine AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["npm", "run", "dev"]

# 2. Rebuild the source code only when needed
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Pass build-time environment variables
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=3584"

# Use cache mount for Next.js build cache to enable incremental builds
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# 3. Production image, copy all the files and run next
FROM node:20-alpine AS runner
WORKDIR /app-standalone

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
# Note: standalone output often nests files inside a folder named after the project
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Robust fix for nested standalone output
RUN if [ ! -f "./server.js" ]; then \
    echo "--- DEBUG: server.js NOT in root. Listing current directory: ---"; \
    ls -F; \
    NESTED_DIR=$(find . -maxdepth 2 -name server.js -exec dirname {} \;) ; \
    if [ -n "$NESTED_DIR" ] && [ "$NESTED_DIR" != "." ]; then \
    echo "--- DEBUG: Found server.js in $NESTED_DIR. Moving contents to root... ---"; \
    cp -r "$NESTED_DIR"/. . && rm -rf "$NESTED_DIR"; \
    else \
    echo "--- DEBUG: Could not find server.js anywhere in subdirectories. ---"; \
    fi; \
    else \
    echo "--- DEBUG: server.js already exists in root. No move needed. ---"; \
    fi

# Final critical verification
RUN if [ ! -f "./server.js" ]; then \
    echo "--- CRITICAL ERROR: server.js is MISSING after all checks. Dumping full directory tree: ---"; \
    ls -R; \
    exit 1; \
    fi

USER nextjs

EXPOSE 3000

ENV PORT=3000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]
