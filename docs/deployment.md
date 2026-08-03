# Deployment

Set production values in the deployment secret store, especially `DATABASE_URL`, `JWT_ACCESS_SECRET`, `WEB_ORIGIN`, and `COOKIE_SECURE=true`. Run `prisma migrate deploy` before rolling out the API. Terminate TLS at a managed load balancer or hardened Nginx configuration, then enable encrypted off-site database backups.
