FROM --platform=amd64 node:20 as build-frontend

# Install system dependencies for canvas
RUN apt-get update && apt-get install -y \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    build-essential \
    python3

# Update npm to latest version
RUN npm install -g npm@latest

# Set the working directory
WORKDIR /app

# Add the source code to app
COPY ./frontend /app/bpni
COPY ./lib /app/lib

# Copy all assets including manual directory
COPY ./assets /app/bpni/assets
COPY ./assets/manual /app/bpni/assets/manual

# Generate the lib packages
WORKDIR /app/lib
RUN npm install --force

WORKDIR /app/bpni

# Install all the backend dependencies
RUN npm install --force

# Generate the build of the application
RUN npm run build

# Stage 2: Build backend
FROM --platform=amd64 node:20 as build

# Install system dependencies for canvas
RUN apt-get update && apt-get install -y \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    build-essential \
    python3

# Update npm to latest version
RUN npm install -g npm@latest

# Set the working directory
WORKDIR /app

# Add the source code to app
COPY ./ /app/bpni

# Set the new working dir
WORKDIR /app/bpni

# Generate the lib packages
WORKDIR /app/bpni/lib
RUN npm install --force

# Install all the backend dependencies
WORKDIR /app/bpni
RUN npm install --force

# Generate the build of the application
RUN npm run tsc

# Copy over frontend and assets
COPY --from=build-frontend /app/bpni/dist/blueprintnotincluded /app/bpni/app/public
COPY --from=build-frontend /app/bpni/assets /app/bpni/assets
COPY --from=build-frontend /app/bpni/assets/images /app/bpni/assets/images
COPY --from=build-frontend /app/bpni/assets/manual /app/bpni/assets/manual

# Ensure database.json and manual assets are copied
COPY ./assets/database/database.json /app/bpni/assets/database/
COPY ./assets/manual /app/bpni/assets/manual

# Expose port 3000
EXPOSE 3000

ENTRYPOINT npm run dev

ENV SITE_URL=http://localhost:3000
ENV ENV_NAME=development
ENV SMTP_HOST=localhost
ENV SMTP_PORT=25
ENV SMTP_USER=
ENV SMTP_PASS=
ENV SMTP_FROM=help@blueprintnotincluded.org
