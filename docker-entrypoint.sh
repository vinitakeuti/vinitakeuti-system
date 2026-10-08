#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL precisa estar configurada antes de iniciar o container." >&2
  exit 1
fi

echo "Aplicando migrations do Prisma..."
./node_modules/.bin/prisma migrate deploy

echo "Iniciando aplicação Next.js..."
exec node server.js
