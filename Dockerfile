# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application files and persistent database/backups
COPY server/ ./server/
COPY data/ ./data/

# Environment variables
ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "--experimental-sqlite", "server/index.js"]
