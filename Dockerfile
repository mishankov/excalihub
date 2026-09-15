FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run check && npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/app/data/excalihub.sqlite BODY_SIZE_LIMIT=21M
COPY package*.json .npmrc ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/build ./build
COPY --from=build /app/server/store.mjs ./server/store.mjs
COPY --from=build /app/scripts/users.mjs ./scripts/users.mjs
COPY --from=build /app/scripts/start.mjs ./scripts/start.mjs
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
CMD ["node", "scripts/start.mjs"]
