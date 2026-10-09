# Proxy image for Cloud Run. Build from the repo root:
#   docker build -f apps/proxy/Dockerfile -t routes-proxy .

# 1. Build: install the proxy's workspaces and compile TypeScript.
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
# npm ci needs every workspace's manifest to match the lockfile.
COPY packages/api-types/package.json packages/api-types/
COPY packages/routing-core/package.json packages/routing-core/
COPY apps/proxy/package.json apps/proxy/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci --workspace @routes/proxy --include-workspace-root --ignore-scripts --no-audit --no-fund
COPY packages/api-types packages/api-types
COPY apps/proxy apps/proxy
RUN npx tsc --build apps/proxy

# 2. Production dependencies only.
FROM node:22-bookworm-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
# npm ci needs every workspace's manifest to match the lockfile.
COPY packages/api-types/package.json packages/api-types/
COPY packages/routing-core/package.json packages/routing-core/
COPY apps/proxy/package.json apps/proxy/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci --workspace @routes/proxy --omit=dev --ignore-scripts --no-audit --no-fund

# 3. Runtime: distroless Node 22, non-root.
FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=deps /repo/node_modules node_modules
COPY --from=build /repo/packages/api-types/package.json packages/api-types/
COPY --from=build /repo/packages/api-types/dist packages/api-types/dist
COPY --from=build /repo/apps/proxy/package.json apps/proxy/
COPY --from=build /repo/apps/proxy/dist apps/proxy/dist
# Mock mode (PROVIDER=mock) serves these instead of calling Google.
COPY fixtures fixtures
USER nonroot
EXPOSE 8080
CMD ["apps/proxy/dist/server.js"]
