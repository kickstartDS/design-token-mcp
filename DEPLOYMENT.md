# Deployment Guide

This guide explains how to deploy the Design Tokens MCP Server using Docker and Kamal.

## Prerequisites

- Docker installed locally
- [Kamal](https://kamal-deploy.org) installed (`gem install kamal`)
- A server with SSH access (for production deployment)
- GitHub Container Registry access (or another Docker registry)

## Local Development with Docker

### Build and run locally

```bash
# Build the Docker image
docker build -t design-tokens-mcp .

# Run interactively (MCP uses stdio)
docker run -it --rm design-tokens-mcp

# Run with mounted tokens for development
docker run -it --rm -v $(pwd)/tokens:/app/tokens:ro design-tokens-mcp
```

### Using Docker Compose

```bash
# Start the service
docker compose up --build

# Run in detached mode
docker compose up -d --build

# View logs
docker compose logs -f

# Stop the service
docker compose down
```

## Production Deployment with Kamal

### 1. Configure your deployment

Edit `config/deploy.yml` and update:

- `servers.web.hosts` - Your server IP or hostname
- `traefik.*.labels` - Your domain name
- `traefik.args.certificatesResolvers.letsencrypt.acme.email` - Your email for SSL certificates
- `ssh.user` - Your SSH user on the server

### 2. Set up secrets

```bash
# Create secrets file (don't commit this!)
cp .kamal/secrets.example .kamal/secrets

# Edit with your credentials
nano .kamal/secrets
```

Required secrets:

- `KAMAL_REGISTRY_USERNAME` - GitHub username
- `KAMAL_REGISTRY_PASSWORD` - GitHub Personal Access Token with `write:packages` scope

### 3. Set up your server

```bash
# Bootstrap Kamal on your server (first time only)
kamal setup
```

### 4. Deploy

```bash
# Deploy to production
kamal deploy

# View deployment logs
kamal app logs

# Check deployment status
kamal details
```

### 5. Common Kamal commands

```bash
# Rollback to previous version
kamal rollback

# Restart the application
kamal app restart

# Execute command in running container
kamal app exec "node -e 'console.log(process.version)'"

# View Traefik logs
kamal traefik logs

# Remove everything
kamal remove
```

## Environment Variables

| Variable   | Description      | Default      |
| ---------- | ---------------- | ------------ |
| `NODE_ENV` | Environment mode | `production` |

## Container Registry

The default configuration uses GitHub Container Registry (ghcr.io). To use a different registry:

1. Update `registry.server` in `config/deploy.yml`
2. Update your secrets accordingly

### Using Docker Hub

```yaml
registry:
  server: docker.io
  username:
    - DOCKER_USERNAME
  password:
    - DOCKER_PASSWORD
```

## Health Checks

The container includes a health check that verifies the Node.js process can start properly. Since MCP servers communicate via stdio (not HTTP), traditional HTTP health checks don't apply.

## Troubleshooting

### Container won't start

```bash
# Check container logs
docker logs design-tokens-mcp

# Run with verbose output
docker run -it --rm -e DEBUG=* design-tokens-mcp
```

### Kamal deployment fails

```bash
# Check Kamal logs
kamal app logs -f

# SSH into server and check Docker
kamal app exec bash
docker ps -a
docker logs <container-id>
```

### SSL certificate issues

```bash
# Check Traefik logs
kamal traefik logs

# Verify DNS is pointing to your server
dig your-domain.com
```

## MCP Server Notes

MCP (Model Context Protocol) servers communicate via stdio, not HTTP. This means:

- The container runs interactively with stdin/stdout
- Traditional load balancing doesn't apply
- Each MCP client connects to its own server instance

For production use with multiple clients, consider:

1. Running multiple container instances
2. Implementing HTTP-SSE transport (MCP 2024-11-05 spec)
3. Using a message broker for scaling
