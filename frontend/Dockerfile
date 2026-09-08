# Stage 1: Build Vite React SPA
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_APP_NAME=LojmanYönetim
ARG VITE_APP_SUBTITLE="Personel Konaklama & Lojman Portalı"
ARG VITE_COPYRIGHT_TEXT="© 2026 Personel Lojman Yönetim Sistemi. Tüm hakları saklıdır."
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_SUBTITLE=$VITE_APP_SUBTITLE
ENV VITE_COPYRIGHT_TEXT=$VITE_COPYRIGHT_TEXT
RUN npm run build

# Stage 2: Serve via Nginx
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
