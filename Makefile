.PHONY: dev prod stop migrate migrate-prod seed demo-up demo-down demo-seed demo-reset logs backup-db health

dev:
	docker-compose up -d postgres redis
	pnpm --filter backend dev &
	pnpm --filter panel dev &

prod:
	docker-compose -f docker-compose.prod.yml up -d --build

stop:
	docker-compose down
	docker-compose -f docker-compose.prod.yml down

migrate:
	pnpm --filter backend prisma:migrate

migrate-prod:
	pnpm --filter backend prisma:deploy

seed:
	pnpm --filter backend seed

demo-up:
	docker-compose -f docker-compose.demo.yml up -d

demo-down:
	docker-compose -f docker-compose.demo.yml down

demo-seed:
	DATABASE_URL="postgresql://senkronize:demo_password_2024@localhost:5433/senkronize_demo" \
	  ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
	  pnpm --filter backend exec ts-node prisma/seed-demo.ts

demo-reset:
	docker compose -f docker-compose.demo.yml down -v
	$(MAKE) demo-up
	sleep 8
	$(MAKE) demo-seed

logs:
	docker-compose -f docker-compose.prod.yml logs -f backend

backup-db:
	mkdir -p backups
	docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U $${DB_USER} $${DB_NAME} > backups/backup_$$(date +%Y%m%d_%H%M%S).sql

health:
	curl -f http://localhost:3000/api/v1/health || echo "Backend down"
