FROM node:20-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl wget ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
COPY scripts ./scripts
RUN chmod +x scripts/docker-entrypoint.sh && mkdir -p uploads
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD wget -qO- http://localhost:3000/api/health || exit 1
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
