FROM node:20-alpine AS build

WORKDIR /app

# Install native build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime image ----
FROM node:20-alpine AS runtime

WORKDIR /app

# Runtime deps for better-sqlite3 native bindings
RUN apk add --no-cache libstdc++

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Data and uploads volumes
RUN mkdir -p /app/data /app/uploads
ENV DB_PATH=/app/data/warrantyvault.db
ENV UPLOADS_DIR=/app/uploads
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/index.js"]
