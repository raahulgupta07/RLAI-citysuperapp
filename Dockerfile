FROM node:20-slim

# better-sqlite3 needs build tools
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install deps
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm install

# Copy source
COPY frontend/ ./frontend/

# Copy env
COPY .env ./.env

# Build
RUN cd frontend && npm run build

# Create data directory
RUN mkdir -p /app/frontend/data

EXPOSE 3000

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["node", "frontend/build"]
