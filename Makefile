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
