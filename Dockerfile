FROM node:20-slim

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_AGENTS_URL=http://localhost:8002
ARG VITE_RESEARCH_USER=default
ENV VITE_AGENTS_URL=$VITE_AGENTS_URL
ENV VITE_RESEARCH_USER=$VITE_RESEARCH_USER

RUN npm run build

EXPOSE 3001
CMD ["node", "server.js"]
