FROM node:26-bookworm-slim AS build
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run check && npm run build

FROM oven/bun:1-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/app/data/excalihub.sqlite BODY_SIZE_LIMIT=21M
# Bun runs the adapter output and account scripts without production dependencies.
COPY --from=build /app/build ./build
COPY --from=build /app/server/store.mjs ./server/store.mjs
COPY --from=build /app/scripts/users.mjs ./scripts/users.mjs
COPY --from=build /app/scripts/start.mjs ./scripts/start.mjs
RUN mkdir -p /app/data && chown bun:bun /app/data
USER bun
EXPOSE 3000
CMD ["bun", "scripts/start.mjs"]
