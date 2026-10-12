# Imagen del RECEPTOR DE NOTIFICACIONES (no del servidor MCP por stdio).
# Sirve para Render, Google Cloud Run, Fly.io o cualquier host de contenedores.
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --ignore-scripts
COPY src ./src
USER node
EXPOSE 3000
ENV PORT=3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1
CMD ["node", "src/notificaciones.js"]
