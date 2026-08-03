// Vercel Node.js serverless entry point. The Express application handles every
// /api/* request, including the versioned /api/v1/* API routes.
export { app as default } from '../apps/api/src/app.js';
