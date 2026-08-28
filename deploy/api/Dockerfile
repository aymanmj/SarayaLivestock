FROM node:22-bookworm-slim AS build

WORKDIR /app
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build

COPY apps/api/package.json apps/api/package-lock.json ./
COPY apps/api/prisma.config.ts ./
COPY apps/api/prisma ./prisma
RUN npm ci

COPY apps/api/nest-cli.json apps/api/tsconfig.json apps/api/tsconfig.build.json ./
COPY apps/api/src ./src

RUN npm run build

FROM build AS operations
ENV NODE_ENV=production
VOLUME ["/backups"]
CMD ["npm", "run", "db:inspect"]

FROM node:22-bookworm-slim AS runtime-dependencies
WORKDIR /app
COPY apps/api/package.json apps/api/package-lock.json ./
COPY apps/api/prisma.config.ts ./
COPY apps/api/prisma ./prisma
RUN npm ci --omit=dev --omit=peer \
    && npm rm prisma --omit=dev --ignore-scripts --no-save --legacy-peer-deps --no-audit --no-fund \
    && npm cache clean --force

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000
WORKDIR /app

COPY --from=runtime-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 4000
STOPSIGNAL SIGTERM
CMD ["node", "dist/main.js"]
