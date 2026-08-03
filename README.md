# RRPL Housing Group ERP

Internal CRM/ERP for RRPL Housing Group. The repository uses npm workspaces: `apps/api`, `apps/web`, and `packages/shared`.

## Local setup

1. Install Node.js 22+ and Docker Desktop.
2. Copy `.env.example` to `.env` and replace all development secrets before shared use.
3. Run `docker compose up -d postgres`.
4. Run `npm install`, then `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed`.
5. Run `npm run dev`.

API: `http://localhost:4000/api/v1`; web: `http://localhost:5173`.

Development administrator: `admin@rrpl.local` / `ChangeMe@123`. It must be changed on first login.

## Backups

With Docker running: `docker compose exec -T postgres pg_dump -U rrpl -d rrpl_erp | gzip > backups/rrpl-$(date +%F).sql.gz`. Keep encrypted off-site copies; do not commit backups.

## Production deployment

This is a Node.js/PostgreSQL application and requires a VPS, managed container host, or private server. Standard static/shared web hosting is not suitable. Copy `.env.production.example` to `.env`, set a real domain in `WEB_ORIGIN`, replace every secret, then run `docker compose -f docker-compose.production.yml up -d --build`. Configure TLS certificates at the reverse proxy before exposing the ERP publicly. Restrict access at the firewall or VPN because this is internal-office software.

## Security notes

Refresh tokens are only stored as hashes in PostgreSQL and returned in HTTP-only cookies. Access tokens remain in memory on the client. RBAC is enforced by API middleware and services; frontend checks are only UX controls.
