FROM node:18-alpine

# Install nginx (no supervisor)
RUN apk add --no-cache nginx

WORKDIR /app

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app code and nginx config
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Set env variable
ENV PORT=5000

EXPOSE 5000 80

# Start both Node.js and NGINX
CMD ["node", "server.js"]