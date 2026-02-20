#!/bin/bash
# Deploy InsightOdds Panel to VPS
# Usage: ./deploy.sh

set -e

VPS_IP="31.57.228.137"
VPS_USER="root"
DOMAIN="signalpulses.in"
APP_DIR="/opt/insightodds"

echo "=== InsightOdds Panel Deployment ==="
echo "Target: ${VPS_USER}@${VPS_IP}"
echo ""

# Step 1: SSH and setup server
echo "[1/5] Setting up server..."
ssh ${VPS_USER}@${VPS_IP} << 'SETUP_EOF'
  # Install Docker if not present
  if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
  fi

  # Install Docker Compose
  if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
  fi

  # Install Certbot
  apt-get update -qq
  apt-get install -y -qq certbot nginx > /dev/null 2>&1 || true

  # Create app directory
  mkdir -p /opt/insightodds
SETUP_EOF

# Step 2: Sync project files
echo "[2/5] Syncing project files..."
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude 'dist' \
  /Users/ajay/Desktop/insightodds-panel/ ${VPS_USER}@${VPS_IP}:${APP_DIR}/

# Step 3: Setup SSL
echo "[3/5] Setting up SSL..."
echo ""
echo "IMPORTANT: Before continuing, make sure DNS is configured:"
echo "  A record: ${DOMAIN} -> ${VPS_IP}"
echo "  A record: www.${DOMAIN} -> ${VPS_IP}"
echo ""
read -p "Is DNS configured? (y/n): " dns_ready
if [ "$dns_ready" != "y" ]; then
  echo "Please configure DNS first and re-run the script."
  exit 1
fi

ssh ${VPS_USER}@${VPS_IP} << CERTBOT_EOF
  # Stop nginx temporarily for certbot
  systemctl stop nginx 2>/dev/null || true

  # Get SSL certificate
  certbot certonly --standalone -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} || true

  # Copy certs for Docker
  mkdir -p ${APP_DIR}/nginx/certs
  cp -rL /etc/letsencrypt/live ${APP_DIR}/nginx/certs/ 2>/dev/null || true
  cp -rL /etc/letsencrypt/archive ${APP_DIR}/nginx/certs/ 2>/dev/null || true

  # Stop system nginx (we use Docker nginx)
  systemctl stop nginx
  systemctl disable nginx
CERTBOT_EOF

# Step 4: Setup production env
echo "[4/5] Setting up environment..."
ssh ${VPS_USER}@${VPS_IP} << 'ENV_EOF'
  cd /opt/insightodds

  if [ ! -f .env ]; then
    JWT_SECRET=$(openssl rand -hex 32)
    JWT_REFRESH_SECRET=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -hex 16)
    REDIS_PASSWORD=$(openssl rand -hex 16)

    cat > .env << EOL
DB_PASSWORD=${DB_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@123
EOL
    echo "Created .env with generated secrets"
  else
    echo ".env already exists, skipping"
  fi
ENV_EOF

# Step 5: Build and start
echo "[5/5] Building and starting services..."
ssh ${VPS_USER}@${VPS_IP} << 'START_EOF'
  cd /opt/insightodds
  docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
  docker-compose -f docker-compose.prod.yml build --no-cache
  docker-compose -f docker-compose.prod.yml up -d

  echo ""
  echo "Waiting for services to start..."
  sleep 10
  docker-compose -f docker-compose.prod.yml ps

  echo ""
  echo "=== Deployment Complete ==="
  echo "Panel: https://signalpulses.in"
  echo "Admin login: admin / Admin@123"
  echo ""
  echo "IMPORTANT: Change the admin password after first login!"
START_EOF
