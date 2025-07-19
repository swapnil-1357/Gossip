# Dockerfile
FROM node:18-alpine

# Install nginx and supervisord
RUN apk add --no-cache nginx supervisor

# Set workdir
WORKDIR /app

# Copy app files
COPY . .

# Install Node.js dependencies
RUN npm ci --omit=dev

# Copy NGINX config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy supervisor config
COPY supervisord.conf /etc/supervisord.conf

# Expose port for NGINX
EXPOSE 80

# Start both NGINX and Node.js apps via supervisord
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
