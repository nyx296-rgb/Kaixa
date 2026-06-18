#!/bin/sh
set -e

if [ -z "$BACKEND_URL" ]; then
  echo "ERROR: BACKEND_URL is required (e.g. https://your-backend.up.railway.app)"
  exit 1
fi

PORT="${PORT:-80}"

echo "Starting nginx on port $PORT proxying to $BACKEND_URL"

sed \
  -e "s|\${BACKEND_URL}|${BACKEND_URL}|g" \
  -e "s|\${PORT}|${PORT}|g" \
  /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
