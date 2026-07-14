# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build app
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

# Base config + server block template (envsubst'd by the nginx entrypoint on
# start, so BACKEND_HOST/BACKEND_PORT can point at any hostname at runtime)
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf.template /etc/nginx/templates/default.conf.template
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=3000

# Copy built app from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
