FROM node:18-alpine

# Install NGINX and Supervisor
RUN apk add --no-cache nginx supervisor

# Create app directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app source
COPY . .

# Copy nginx and supervisor configs
COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisord.conf

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose NGINX port (public entry)
EXPOSE 80

# Use supervisor to run both app servers + nginx
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
