#!/bin/sh
set -e

if [ -z "$BACKEND_URL" ]; then
  echo "ERROR: BACKEND_URL is required (e.g. https://your-backend.up.railway.app)"
  exit 1
fi

# Auto-add https:// if missing
case "$BACKEND_URL" in
  http://*|https://*) ;;
  *) BACKEND_URL="https://$BACKEND_URL" ;;
esac

# Remove trailing slash
BACKEND_URL="${BACKEND_URL%/}"

# Extract hostname for Host header (strip protocol)
BACKEND_HOST=$(echo "$BACKEND_URL" | sed 's|https\?://||' | sed 's|/.*||' | sed 's|:.*||')

PORT="${PORT:-80}"

echo "=== Nginx Startup ==="
echo "PORT: $PORT"
echo "BACKEND_URL: $BACKEND_URL"
echo "BACKEND_HOST: $BACKEND_HOST"

sed \
  -e "s|\${BACKEND_URL}|${BACKEND_URL}|g" \
  -e "s|\${BACKEND_HOST}|${BACKEND_HOST}|g" \
  -e "s|\${PORT}|${PORT}|g" \
  /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

echo "=== Generated nginx config ==="
cat /etc/nginx/conf.d/default.conf
echo "=== Starting nginx ==="

exec nginx -g 'daemon off;'
