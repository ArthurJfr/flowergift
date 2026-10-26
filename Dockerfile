# --- build ---
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
# L'image slim n'a pas Python. better-sqlite3 embarque déjà son .node ;
# on ignore node-gyp, puis on termine l'install d'esbuild (binaire Vite).
RUN npm ci --ignore-scripts && node node_modules/esbuild/install.js
COPY . .
RUN npm run build

# --- runtime ---
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
# migrations SQL lues au démarrage
COPY src/server/db/migrations ./dist/server/db/migrations
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server/index.js"]
