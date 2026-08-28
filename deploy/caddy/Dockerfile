FROM node:22-bookworm-slim AS web-build

WORKDIR /web
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web ./
RUN npm run build

FROM caddy:2-alpine
COPY --from=web-build /web/dist /srv/web
