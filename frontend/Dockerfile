# Etapa de compilacion: genera dist/frontend/browser
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

# Etapa de ejecucion: Caddy sirve los archivos estaticos y reenvia /auth y /api al backend
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist/frontend/browser /usr/share/caddy
# Railway define PORT; este valor solo aplica fuera de Railway y mantiene
# el mapeo 4200:80 de docker compose
ENV PORT=80
EXPOSE 80
