# Build frontend
FROM node:20 AS frontend-builder

# Set the working directory
WORKDIR /app

# Add the source code to app
COPY --chown=node:node ./frontend /app/bpni
COPY --chown=node:node ./lib /app/lib

# Set permissions for npm
USER root
RUN mkdir -p /app/bpni/node_modules /app/lib/node_modules && \
    chown -R node:node /app/bpni /app/lib

# Switch to non-root user for builds
USER node

# Build lib
WORKDIR /app/lib
RUN npm install

# Build frontend
WORKDIR /app/bpni
RUN npm install && npm run build

# Build backend
FROM node:20

# Set the working directory and create necessary directories
WORKDIR /app
# Set permissions and create directories
USER root
RUN mkdir -p /app/bpni/node_modules /app/bpni/assets /app/bpni/frontend/src/assets && \
    chown -R node:node /app/bpni && \
    chmod -R 755 /app/bpni

# Copy backend files and frontend build
COPY --chown=node:node ./ /app/bpni/
COPY --from=frontend-builder --chown=node:node /app/bpni/dist/blueprintnotincluded /app/bpni/app/public
# Copy source assets for backend scripts (but the built assets are already in app/public from Angular build)
COPY --from=frontend-builder --chown=node:node /app/bpni/src/assets /app/bpni/frontend/src/assets

# Ensure assets directory exists and has correct permissions
USER root
RUN mkdir -p /app/bpni/app/public/assets/images && \
    chown -R node:node /app/bpni/app/public/assets && \
    chmod -R 755 /app/bpni/app/public/assets
USER node

# Install dependencies and build
WORKDIR /app/bpni/lib
RUN npm install
WORKDIR /app/bpni 
RUN npm install
RUN npm run tsc

# Add global polyfills
RUN echo "require('jsdom-global')();" > /app/bpni/app/global-polyfills.js

# Set environment variables
ENV SITE_URL=http://localhost:3000 \
    ENV_NAME=development \
    SMTP_HOST=localhost \
    SMTP_PORT=25 \
    SMTP_USER= \
    SMTP_PASS= \
    SMTP_FROM=help@blueprintnotincluded.org

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "-r", "/app/bpni/app/global-polyfills.js", "/app/bpni/node_modules/.bin/ts-node-dev", "--respawn", "--transpile-only", "app/server.ts"]