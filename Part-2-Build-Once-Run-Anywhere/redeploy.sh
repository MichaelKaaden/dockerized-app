#! /bin/bash
export COMPOSE_HTTP_TIMEOUT=300
docker-compose down --remove-orphans
docker-compose up -d
