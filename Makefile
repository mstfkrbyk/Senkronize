.PHONY: dev prod stop migrate seed logs backup-db

dev:
	docker-compose up -d
	pnpm --filter backend dev & pnpm --filter panel dev & pnpm --filter marketing dev

prod:
	docker-compose -f docker-compose.prod.yml up -d --build

stop:
	docker-compose -f docker-compose.prod.yml down

migrate:
	docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

seed:
	docker-compose -f docker-compose.prod.yml exec backend npx prisma db seed

logs:
	docker-compose -f docker-compose.prod.yml logs -f --tail=100

backup-db:
	docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U senkronize senkronize > backup_$(shell date +%Y%m%d_%H%M%S).sql

demo-up:
	docker compose -f docker-compose.demo.yml up -d

demo-down:
	docker compose -f docker-compose.demo.yml down

demo-seed:
	DATABASE_URL="postgresql://senkronize:demo_password_2024@localhost:5433/senkronize_demo" \
	  ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
	  pnpm --filter backend exec ts-node prisma/seed-demo.ts

demo-reset:
	docker compose -f docker-compose.demo.yml down -v
	$(MAKE) demo-up
	sleep 8
	$(MAKE) demo-seed
