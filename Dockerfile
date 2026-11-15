# SAT Trainer backend — works on Fly.io, Render (Docker), Cloud Run, Railway, a VPS.
#   docker build -t sat-trainer .
#   docker run -p 8080:8080 -e GOOGLE_CLIENT_ID=... -e SAT_ALLOWED_ORIGINS=https://kartbala07.github.io sat-trainer

FROM node:24-alpine

WORKDIR /app

# only what the server actually needs at runtime
COPY package.json ./
COPY index.html styles.css styles2.css styles3.css ./
COPY js ./js
COPY lib ./lib
COPY vendor ./vendor
COPY data ./data
COPY server.mjs ./

# the account database lives outside the app directory so it can be mounted
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    SAT_DATA_DIR=/data

RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
