FROM node:20-alpine AS build

WORKDIR /app

# Install native build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune devDependencies in-place before copying to runtime
RUN npm prune --omit=dev

# ---- Runtime image ----
FROM node:20-alpine AS runtime

WORKDIR /app

# Runtime deps for better-sqlite3 native bindings
RUN apk add --no-cache libstdc++

# Copy already-built + pruned node_modules — avoids rebuilding native modules
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

RUN mkdir -p /data /uploads
ENV DB_PATH=/data/warrantyvault.db
ENV UPLOADS_DIR=/uploads
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/index.js"]
