# Docker Configuration

This directory contains Docker configuration files for Fermi Client.

## Directory Structure

```
.docker/
├── Dockerfile           # Optimized multi-stage Docker image
├── docker-compose.yml   # Fully configured compose file
├── .env.example         # Environment variables template
└── README.md            # This file
```

## Quick Start

### Option 1: Using Makefile (Recommended)

```bash
# Initial setup (creates .env file)
make setup

# Build and start
make build
make up

# View logs
make logs
```

### Option 2: Using Docker Compose Directly

#### 1. Setup Environment Variables

```bash
# Create .env file
cp .docker/.env.example .docker/.env

# Edit values if needed
nano .docker/.env
```

#### 2. Run with Docker Compose

```bash
# Build the image (git commit hash is automatically detected)
GIT_COMMIT=$(git rev-parse HEAD) docker-compose -f .docker/docker-compose.yml build

# Start the application
docker-compose -f .docker/docker-compose.yml up -d

# Follow logs
docker-compose -f .docker/docker-compose.yml logs -f

# Stop the application
docker-compose -f .docker/docker-compose.yml down

# Remove volumes as well
docker-compose -f .docker/docker-compose.yml down -v
```

#### 3. Run with Docker Only

```bash
# Build image
docker build -f .docker/Dockerfile -t fermi-client:latest .

# Create data directories
mkdir -p ./data/{app_data,logs,config}
echo '{}' > ./data/uptime.json

# Run container
docker run -d \
  --name fermi-client \
  -p 8080:8080 \
  -v $(pwd)/data/app_data:/app/data \
  -v $(pwd)/data/logs:/app/logs \
  -v $(pwd)/data/config:/app/config:ro \
  -v $(pwd)/data/uptime.json:/app/uptime.json \
  fermi-client:latest
```

## Configuration Details

### Port Mapping
- **Host Port**: 8080 (default, configurable via .env)
- **Container Port**: 8080

### Volumes
All volumes are mounted from the `BASE_PWD` directory (default: `../data` relative to `.docker/`):
- `${BASE_PWD}/app_data` → `/app/data`: Application data
- `${BASE_PWD}/logs` → `/app/logs`: Application logs
- `${BASE_PWD}/config` → `/app/config`: Configuration files (read-only)
- `${BASE_PWD}/uptime.json` → `/app/uptime.json`: Uptime tracking

**Note**: The data directory structure is automatically created when using `make up` or `make init-dirs`.

### Network
- **Network Name**: fermi_network
- **Driver**: bridge
- **Subnet**: 172.25.0.0/16

### Resource Limits
- **CPU Limit**: 1.0 core
- **Memory Limit**: 512MB
- **CPU Reservation**: 0.25 core
- **Memory Reservation**: 256MB

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `production` |
| `HOST_PORT` | Host port | `8080` |
| `CONTAINER_PORT` | Container port | `8080` |
| `BASE_PWD` | Base path for all volume mounts | `../data` |
| `LOG_LEVEL` | Logging level | `info` |
| `VERSION` | Image version | `latest` |
| `GIT_COMMIT` | Git commit hash for build | `unknown` |

**Notes**:
- The `GIT_COMMIT` variable is automatically detected when using the Makefile. If building manually with `docker-compose`, set it with:
  ```bash
  GIT_COMMIT=$(git rev-parse HEAD) docker-compose build
  ```
- The `BASE_PWD` directory should be created before starting the container. All application data, logs, and config files will be stored here.

## Health Check

Container performs automatic health checks:
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3
- **Start Period**: 40 seconds

## Security

- Non-root user (`fermi`)
- Security opt: `no-new-privileges`
- Read-only config mount
- Resource limits
- Minimal Alpine base image

## Maintenance Commands

```bash
# Check container status
docker-compose -f .docker/docker-compose.yml ps

# Open shell in container
docker-compose -f .docker/docker-compose.yml exec fermi-client sh

# List volumes
docker volume ls | grep fermi

# Check disk usage
docker system df

# Cleanup
docker system prune -a
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose -f .docker/docker-compose.yml logs

# Check health status
docker inspect fermi-client | grep -A 10 Health
```

### Port already in use
```bash
# Change HOST_PORT in .env file
HOST_PORT=8081
```

### Volume permissions
```bash
# Recreate volumes
docker-compose -f .docker/docker-compose.yml down -v
docker-compose -f .docker/docker-compose.yml up -d
```
