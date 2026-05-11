#!/bin/bash

# Создаем сеть для контейнеров
podman network create leanstock-network 2>/dev/null || echo "Network already exists"

# PostgreSQL
podman run -d \
  --name leanstock-db \
  --network leanstock-network \
  -e POSTGRES_USER=leanstock \
  -e POSTGRES_PASSWORD=leanstock123 \
  -e POSTGRES_DB=leanstock \
  -p 5432:5432 \
  -v leanstock-postgres:/var/lib/postgresql/data \
  docker.io/postgres:15-alpine

# Redis
podman run -d \
  --name leanstock-redis \
  --network leanstock-network \
  -p 6379:6379 \
  -v leanstock-redis:/data \
  docker.io/redis:7-alpine

echo "✅ БД и Redis запущены!"
echo ""
echo "Проверка статуса:"
podman ps
