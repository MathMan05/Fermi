# Fermi Client - Docker Makefile
.PHONY: help build up down logs restart clean ps exec shell health init-dirs

# Docker Compose file path
COMPOSE_FILE := .docker/docker-compose.yml

# Base data directory (can be overridden)
BASE_PWD ?= ./data

help: ## Show this help message
	@echo "Fermi Client Docker Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

init-dirs: ## Create required data directories
	@mkdir -p $(BASE_PWD)/app_data $(BASE_PWD)/logs $(BASE_PWD)/config
	@if [ ! -f $(BASE_PWD)/uptime.json ]; then echo '{}' > $(BASE_PWD)/uptime.json; fi
	@echo "Data directories created at: $(BASE_PWD)"

build: ## Build Docker image
	GIT_COMMIT=$$(git rev-parse HEAD 2>/dev/null || echo "unknown") docker-compose -f $(COMPOSE_FILE) build

up: init-dirs ## Start container (detached mode)
	docker-compose -f $(COMPOSE_FILE) up -d

down: ## Stop container
	docker-compose -f $(COMPOSE_FILE) down

logs: ## Show logs (follow mode)
	docker-compose -f $(COMPOSE_FILE) logs -f

restart: ## Restart container
	docker-compose -f $(COMPOSE_FILE) restart

clean: ## Stop container and remove volumes
	docker-compose -f $(COMPOSE_FILE) down -v

ps: ## List running containers
	docker-compose -f $(COMPOSE_FILE) ps

exec: ## Open bash/sh in container
	docker-compose -f $(COMPOSE_FILE) exec fermi-client sh

shell: exec ## Same as exec

health: ## Show health check status
	@docker inspect fermi-client | grep -A 10 "Health" || echo "Container is not running"

rebuild: down build up ## Rebuild and restart container

dev: ## Development mode (with logs)
	docker-compose -f $(COMPOSE_FILE) up

setup: ## Initial setup (copy env file)
	@if [ ! -f .docker/.env ]; then \
		cp .docker/.env.example .docker/.env; \
		echo ".env file created. Please edit .docker/.env as needed."; \
	else \
		echo ".env file already exists."; \
	fi
