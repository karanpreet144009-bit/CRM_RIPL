// Explicit Vercel catch-all for the versioned Express API.
// Vercel routes nested API paths through this serverless entry point.
export { app as default } from '../../apps/api/src/app.js';
