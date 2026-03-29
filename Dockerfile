FROM node:20-alpine

# Install netcat for health checks
RUN apk add --no-cache netcat-openbsd

# Install opencli globally
RUN npm install -g @jackwener/opencli

# Copy app files
COPY start.sh /start.sh
COPY mcp-server.js /app/mcp-server.js
RUN chmod +x /start.sh

EXPOSE 3000
CMD ["/start.sh"]
