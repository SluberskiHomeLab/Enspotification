# Enspotification Reverse Proxy Troubleshooting Guide

## 504 Gateway Timeout Error Solutions

### Problem Diagnosis

1. **Check if Enspotification is running**:
   ```bash
   docker-compose ps
   curl http://localhost:3000/health
   ```

2. **Check reverse proxy logs** for specific error messages

### Solution 1: Docker Network Configuration

If running reverse proxy in Docker, ensure proper networking:

**docker-compose.yml with shared network:**
```yaml
services:
  enspotification:
    build: .
    expose:
      - "3000"  # Don't publish to host, only expose to other containers
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    restart: unless-stopped
    networks:
      - web
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  web:
    external: true  # Create with: docker network create web

volumes:
  enspotification_data:
```

### Solution 2: Nginx Configuration with Proper Timeouts

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        
        # Essential proxy headers
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout settings - INCREASE THESE
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        
        # Disable cache bypass for upgrade connections
        proxy_cache_bypass $http_upgrade;
    }
}
```

**For Docker Nginx, use container name:**
```nginx
upstream enspotification {
    server enspotification:3000;  # Use container name, not localhost
}

server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://enspotification;
        # ... rest of config same as above
    }
}
```

### Solution 3: Caddy Configuration with Timeouts

```caddy
your-domain.com {
    reverse_proxy enspotification:3000 {
        # Timeout settings
        transport http {
            dial_timeout 30s
            response_header_timeout 30s
        }
        
        # Health check
        health_uri /health
        health_interval 30s
        health_timeout 10s
    }
    
    # Enable compression
    encode gzip
}
```

### Solution 4: Traefik Configuration

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v3.0
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.myresolver.acme.tlschallenge=true"
      - "--certificatesresolvers.myresolver.acme.email=your-email@example.com"
      - "--certificatesresolvers.myresolver.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "letsencrypt:/letsencrypt"
    networks:
      - web

  enspotification:
    build: .
    env_file:
      - .env
    restart: unless-stopped
    networks:
      - web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.enspotification.rule=Host(`your-domain.com`)"
      - "traefik.http.routers.enspotification.entrypoints=websecure"
      - "traefik.http.routers.enspotification.tls.certresolver=myresolver"
      - "traefik.http.services.enspotification.loadbalancer.server.port=3000"
      
      # TIMEOUT CONFIGURATION - CRITICAL
      - "traefik.http.services.enspotification.loadbalancer.responseForwarding.flushInterval=1ms"
      - "traefik.http.services.enspotification.loadbalancer.healthCheck.path=/health"
      - "traefik.http.services.enspotification.loadbalancer.healthCheck.interval=30s"
      - "traefik.http.services.enspotification.loadbalancer.healthCheck.timeout=10s"

networks:
  web:
    external: true
```

### Solution 5: Nginx Proxy Manager Settings

In NPM GUI, make sure to configure:

1. **Advanced Tab Settings**:
   ```nginx
   proxy_connect_timeout 60s;
   proxy_send_timeout 60s;
   proxy_read_timeout 60s;
   
   proxy_set_header X-Forwarded-Proto $scheme;
   proxy_set_header X-Forwarded-Host $host;
   proxy_set_header X-Forwarded-Port $server_port;
   ```

2. **Custom Locations** for health check:
   - Location: `/health`
   - Scheme: `http`
   - Forward Hostname/IP: `enspotification`
   - Forward Port: `3000`

### Solution 6: Application-Level Fixes

Add better error handling and keep-alive to the Express server:

```javascript
// In src/index.js, modify the Express setup:
setupExpress() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));
    
    // Add keep-alive and timeout settings
    this.server = this.app.listen(process.env.PORT || 3000, () => {
        console.log(`🌐 Web server running on port ${process.env.PORT || 3000}`);
    });
    
    // Set server timeouts
    this.server.timeout = 60000; // 60 seconds
    this.server.keepAliveTimeout = 65000; // 65 seconds
    this.server.headersTimeout = 66000; // 66 seconds
}
```

## Troubleshooting Steps

1. **Test direct connection**:
   ```bash
   curl -v http://localhost:3000/health
   ```

2. **Check Docker networking**:
   ```bash
   docker network ls
   docker network inspect enspotification_default
   ```

3. **Test from reverse proxy container**:
   ```bash
   docker exec -it nginx_container curl http://enspotification:3000/health
   ```

4. **Check reverse proxy logs**:
   ```bash
   docker logs nginx_container
   docker logs traefik_container
   ```

## Quick Fixes to Try

1. **Restart containers in order**:
   ```bash
   docker-compose down
   docker-compose up -d
   # Wait 30 seconds, then restart reverse proxy
   ```

2. **Use container name instead of localhost** in proxy config

3. **Increase timeout values** in reverse proxy configuration

4. **Check firewall** isn't blocking container-to-container communication

5. **Verify network connectivity**:
   ```bash
   docker exec -it your_proxy_container ping enspotification
   ```

The most common cause is using `localhost` instead of the container name in Docker networking!