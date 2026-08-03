import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
dotenv.config({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)) });
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_ISSUER: z.string().min(1).default('rrpl-housing-group-erp'),
  JWT_AUDIENCE: z.string().min(1).default('rrpl-office-users'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().max(30).default(7),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false').transform(x => x === 'true'),
  OFFICE_ALLOWED_IPS: z.string().default('')
});

export const env = schema.parse(process.env);

if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
  throw new Error('COOKIE_SECURE must be true in production. Configure HTTPS before starting RRPL ERP.');
}
