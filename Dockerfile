FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-bookworm-slim AS chofer-build
WORKDIR /app/app-chofer
COPY app-chofer/package*.json ./
COPY app-chofer/patches ./patches
RUN npm ci
COPY app-chofer/ ./
ENV VITE_BASE_PATH=/chofer/
RUN npm run build

FROM node:22-bookworm-slim AS landing-build
WORKDIR /app/landing-saas
COPY landing-saas/package*.json ./
RUN npm ci
COPY landing-saas/ ./
ENV VITE_BASE_PATH=/landing/
RUN npm run build

FROM node:22-bookworm-slim AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package*.json ./
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && npm ci --omit=dev \
  && npm cache clean --force
COPY --from=backend-build /app/backend/dist ./dist
COPY backend/transportadora.db ./transportadora.db
RUN mkdir -p ./downloads
COPY --from=frontend-build /app/frontend/dist ./public
COPY --from=chofer-build /app/app-chofer/dist ./chofer
COPY --from=landing-build /app/landing-saas/dist ./landing
EXPOSE 8080
CMD ["npm", "start"]
