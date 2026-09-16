# Base Node.js image (Node 22 is required for node:sqlite)
FROM node:22-slim

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy server code and database
COPY server/ ./server/
COPY data/ ./data/

# Port for cloud container
ENV PORT=10000
EXPOSE 10000

CMD ["node", "server/index.js"]
