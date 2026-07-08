#!/usr/bin/env bash
set -e

echo "🚀 Iniciando PostgreSQL..."
sudo service postgresql start

echo "🔎 Verificando PostgreSQL..."
pg_isready

echo "🌐 Subindo BeUpFree na porta 5000..."
node --env-file=.env ./node_modules/.bin/tsx server/index-dev.ts
