#!/usr/bin/env bash
# HX 3D UAE: install the free self-hosted stack on one Linux server (Ubuntu 22.04+ VPS).
#
#   AppFlowy Cloud  (instead of Notion)    → http://SERVER:8080
#   Cal.diy         (instead of Calendly)  → http://SERVER:3001
#   Chatwoot        (instead of Intercom)  → http://SERVER:3000   (WhatsApp + Instagram + email inbox)
#   Cap Web         (instead of Loom)      → http://SERVER:3002
#
# VoiceStudio (instead of ElevenLabs) is a desktop app that needs your own GPU, so it is not installed
# here. See infra/README.md.
#
# Usage:
#   sudo bash infra/install.sh            # everything
#   sudo bash infra/install.sh chatwoot   # only one: appflowy | caldiy | chatwoot | cap
#
# Every tool is installed from its own official repo and docker-compose file, in /opt/hx3d/<tool>.
# Ports are moved so the four tools don't clash. Needs Docker Compose 2.24.4 or newer.
set -euo pipefail

ROOT="${HX_STACK_DIR:-/opt/hx3d}"
HOST="${HX_HOST:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
HOST="${HOST:-localhost}"
SECRETS="$ROOT/secrets.env"

log() { printf '\n\033[1;35m[HX3D]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[HX3D] %s\033[0m\n' "$*" >&2; exit 1; }
rand() { openssl rand -hex "${1:-32}"; }

# set_env FILE KEY VALUE: replace KEY=... in FILE, or append it.
set_env() {
  local f="$1" k="$2" v="$3"
  if grep -qE "^${k}=" "$f"; then
    local esc; esc=$(printf '%s' "$v" | sed -e 's/[&|\\]/\\&/g')
    sed -i -E "s|^${k}=.*|${k}=${esc}|" "$f"
  else
    printf '%s=%s\n' "$k" "$v" >> "$f"
  fi
}

save_secret() { printf '%s=%s\n' "$1" "$2" >> "$SECRETS"; }

need_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log "Installing Docker"
    curl -fsSL https://get.docker.com | sh
  fi
  docker compose version >/dev/null 2>&1 || die "docker compose plugin missing (apt install docker-compose-plugin)"
  command -v git >/dev/null || { apt-get update -y && apt-get install -y git; }
  command -v openssl >/dev/null || { apt-get update -y && apt-get install -y openssl; }
}

clone() { # clone URL DIR [extra git args]
  local url="$1" dir="$2"; shift 2
  if [ -d "$dir/.git" ]; then git -C "$dir" pull --ff-only || true
  else git clone --depth 1 "$@" "$url" "$dir"; fi
}

# ---------------------------------------------------------------- AppFlowy Cloud
install_appflowy() {
  log "AppFlowy Cloud → http://$HOST:8080"
  local d="$ROOT/appflowy"
  clone https://github.com/AppFlowy-IO/AppFlowy-Cloud.git "$d"
  cd "$d"
  if [ ! -f .env ]; then
    cp deploy.env .env
    local pg admin jwt
    pg=$(rand 16); admin=$(rand 12); jwt=$(rand 32)
    set_env .env FQDN "$HOST:8080"
    set_env .env NGINX_PORT 8080
    set_env .env NGINX_TLS_PORT 8443
    set_env .env POSTGRES_PASSWORD "$pg"
    set_env .env GOTRUE_JWT_SECRET "$jwt"
    set_env .env GOTRUE_ADMIN_EMAIL "${HX_ADMIN_EMAIL:-admin@hx3d.local}"
    set_env .env GOTRUE_ADMIN_PASSWORD "$admin"
    save_secret APPFLOWY_ADMIN_EMAIL "${HX_ADMIN_EMAIL:-admin@hx3d.local}"
    save_secret APPFLOWY_ADMIN_PASSWORD "$admin"
  fi
  docker compose up -d
}

# ---------------------------------------------------------------- Cal.diy
install_caldiy() {
  log "Cal.diy → http://$HOST:3001"
  local d="$ROOT/caldiy"
  clone https://github.com/calcom/cal.diy.git "$d" --recursive
  cd "$d"
  if [ ! -f .env ]; then
    cp .env.example .env
    local url="http://$HOST:3001"
    # The official compose file hard-codes these database credentials; the database is not exposed outside Docker.
    set_env .env POSTGRES_USER unicorn_user
    set_env .env POSTGRES_PASSWORD magical_password
    set_env .env POSTGRES_DB calendso
    set_env .env DATABASE_HOST database:5432
    set_env .env DATABASE_URL "postgresql://unicorn_user:magical_password@database:5432/calendso"
    set_env .env NEXT_PUBLIC_WEBAPP_URL "$url"
    set_env .env NEXTAUTH_URL "$url"
    set_env .env NEXTAUTH_SECRET "$(rand 32)"
    set_env .env CALENDSO_ENCRYPTION_KEY "$(rand 16)"
    set_env .env REDIS_PORT 6380
    set_env .env CALCOM_TELEMETRY_DISABLED 1
  fi
  cat > docker-compose.override.yml <<'YML'
services:
  calcom:
    ports: !override
      - "3001:3000"
YML
  docker compose up -d calcom
}

# ---------------------------------------------------------------- Chatwoot
install_chatwoot() {
  log "Chatwoot → http://$HOST:3000"
  local d="$ROOT/chatwoot"
  mkdir -p "$d" && cd "$d"
  [ -f docker-compose.yaml ] || curl -fsSL -o docker-compose.yaml \
    https://raw.githubusercontent.com/chatwoot/chatwoot/develop/docker-compose.production.yaml
  if [ ! -f .env ]; then
    curl -fsSL -o .env https://raw.githubusercontent.com/chatwoot/chatwoot/develop/.env.example
    local pg rd
    pg=$(rand 16); rd=$(rand 16)
    set_env .env SECRET_KEY_BASE "$(rand 64)"
    set_env .env FRONTEND_URL "http://$HOST:3000"
    set_env .env POSTGRES_HOST postgres
    set_env .env POSTGRES_USERNAME postgres
    set_env .env POSTGRES_PASSWORD "$pg"
    set_env .env REDIS_URL redis://redis:6379
    set_env .env REDIS_PASSWORD "$rd"
    set_env .env DEFAULT_LOCALE ar
    # Chatwoot's compose file reads the Postgres password for its own postgres service from here too.
    sed -i -E "s|POSTGRES_PASSWORD=$|POSTGRES_PASSWORD=$pg|" docker-compose.yaml || true
  fi
  # Publish Chatwoot on all interfaces (the official file binds 127.0.0.1 only).
  cat > docker-compose.override.yml <<'YML'
services:
  rails:
    ports: !override
      - "3000:3000"
YML
  docker compose run --rm rails bundle exec rails db:chatwoot_prepare
  docker compose up -d
}

# ---------------------------------------------------------------- Cap
install_cap() {
  log "Cap Web → http://$HOST:3002"
  local d="$ROOT/cap"
  clone https://github.com/CapSoftware/Cap.git "$d"
  cd "$d"
  if [ ! -f .env ]; then
    local mysql minio
    mysql=$(rand 16); minio=$(rand 16)
    cat > .env <<ENV
CAP_PORT=3002
CAP_URL=http://$HOST:3002
MINIO_PORT=9010
MINIO_CONSOLE_PORT=9011
S3_PUBLIC_URL=http://$HOST:9010
MYSQL_PASSWORD=$mysql
MINIO_ROOT_PASSWORD=$minio
DATABASE_ENCRYPTION_KEY=$(rand 32)
NEXTAUTH_SECRET=$(rand 32)
MEDIA_SERVER_WEBHOOK_SECRET=$(rand 32)
ENV
  fi
  docker compose up -d
}

main() {
  [ "$(id -u)" -eq 0 ] || die "Run with sudo."
  mkdir -p "$ROOT"; touch "$SECRETS"; chmod 600 "$SECRETS"
  need_docker
  local what="${1:-all}"
  case "$what" in
    all)      install_chatwoot; install_caldiy; install_cap; install_appflowy ;;
    appflowy) install_appflowy ;;
    caldiy)   install_caldiy ;;
    chatwoot) install_chatwoot ;;
    cap)      install_cap ;;
    *) die "Unknown tool: $what (appflowy | caldiy | chatwoot | cap)" ;;
  esac
  log "Done. Passwords saved in $SECRETS"
  cat <<EOF

  Chatwoot  http://$HOST:3000   create the admin account, then connect WhatsApp, Instagram and email
  Cal.diy   http://$HOST:3001   the setup wizard opens on first visit
  Cap       http://$HOST:3002
  AppFlowy  http://$HOST:8080   admin login in $SECRETS

  Next step: infra/README.md → "Connect to the agents"
EOF
}

main "$@"
