# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Install system dependencies for audio processing and Puppeteer
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    git \
    libc6-compat \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    pulseaudio \
    pulseaudio-dev \
    alsa-utils \
    alsa-lib \
    alsa-lib-dev \
    libsodium \
    libsodium-dev

# Set working directory
WORKDIR /app

# Set Puppeteer and Playwright environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true \
    PLAYWRIGHT_BROWSERS_PATH=/usr/lib/chromium

# Configure PulseAudio for virtual audio devices
RUN mkdir -p /etc/pulse
COPY docker/pulse-config/default.pa /etc/pulse/default.pa
COPY docker/pulse-config/daemon.conf /etc/pulse/daemon.conf

# Set audio environment variables
ENV PULSE_RUNTIME_PATH=/tmp/pulse \
    XDG_RUNTIME_DIR=/tmp/pulse

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy source code
COPY src/ ./src/
COPY public/ ./public/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S enspotify -u 1001

# Change ownership of the app directory
RUN chown -R enspotify:nodejs /app
USER enspotify

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "start"]