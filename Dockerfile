# syntax=docker/dockerfile:1

# --- Construcción ---
FROM node:22-bookworm-slim AS build
WORKDIR /app
# better-sqlite3 compila su módulo nativo con node-gyp.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*
# El npm 10.9 de la imagen falla al resolver dependencias entre pares («edgesOut»); npm 11 no.
RUN npm install -g npm@11
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# --- Ejecución ---
FROM node:22-bookworm-slim
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg \
	&& rm -rf /var/lib/apt/lists/*
WORKDIR /app
# BODY_SIZE_LIMIT: los videos se suben enteros y el límite por defecto del adapter es 512 KB.
# PROTOCOL_HEADER / HOST_HEADER / ADDRESS_HEADER: detrás de Traefik, el protocolo, el host y la
# IP reales llegan en las cabeceras reenviadas (la IP la usa el límite de preguntas por visitante).
ENV NODE_ENV=production \
	PORT=3000 \
	DATA_DIR=/data \
	BODY_SIZE_LIMIT=2G \
	PROTOCOL_HEADER=x-forwarded-proto \
	HOST_HEADER=x-forwarded-host \
	ADDRESS_HEADER=x-forwarded-for \
	XFF_DEPTH=1
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
	CMD node -e "fetch('http://127.0.0.1:3000/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "build"]
