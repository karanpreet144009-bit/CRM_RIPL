import { app } from './app.js'; import { env } from './config/env.js';
const server = app.listen(env.API_PORT, '0.0.0.0',()=>console.log(`RRPL API listening on :${env.API_PORT}`));
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => server.close(() => process.exit(0)));
