# UCRI Test-Client – eine gebündelte Anwendung (NestJS liefert UCRI-API, UI-API und Angular-Frontend aus)

# ---- Build: shared → frontend → backend ---------------------------------------
FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --no-audit --no-fund

COPY shared shared
COPY backend backend
COPY frontend frontend
RUN npm run build

# ---- Runtime: nur Produktionsabhängigkeiten von backend + shared --------------
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev --no-audit --no-fund -w shared -w backend \
  && npm cache clean --force

COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/frontend/dist frontend/dist
COPY config config

USER node
EXPOSE 3000

# Wichtige Overrides: UCRI_VERSION (1.0|1.1), PORT, PUBLIC_BASE_URL, JWT_SECRET, CONFIG_PATH
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/ui-api/config').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "backend/dist/main.js"]
