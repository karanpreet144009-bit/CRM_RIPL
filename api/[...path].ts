// Vercel Node.js serverless entry point. The existing Express application
// handles every /api/* request, including /api/v1/* routes.
export { app as default } from '../apps/api/src/app.js';
