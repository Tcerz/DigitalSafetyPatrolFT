FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
# Informasi versi (diisi oleh pipeline CI/CD; default untuk build lokal)
ARG APP_VERSION=dev
ARG GIT_COMMIT=local
ARG BUILD_TIME=unknown
ENV APP_VERSION=$APP_VERSION GIT_COMMIT=$GIT_COMMIT BUILD_TIME=$BUILD_TIME
ENV NODE_ENV=production SERVICE_NAME=api-gateway PORT=8080
USER node
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
