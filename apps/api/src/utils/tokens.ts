import crypto from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';
const key = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
export type AccessPayload = { sub: string; roles: string[] };
export async function signAccessToken(payload: AccessPayload) { return new SignJWT({ roles: payload.roles }).setProtectedHeader({ alg: 'HS256' }).setSubject(payload.sub).setIssuer(env.JWT_ISSUER).setAudience(env.JWT_AUDIENCE).setIssuedAt().setExpirationTime(env.JWT_ACCESS_EXPIRES_IN).sign(key); }
export async function verifyAccessToken(token: string) { const { payload } = await jwtVerify(token, key, { issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE, algorithms: ['HS256'] }); if (!payload.sub) throw new Error('JWT subject is missing'); return { sub: payload.sub, roles: (payload.roles as string[]) ?? [] }; }
export function newOpaqueToken() { return crypto.randomBytes(48).toString('base64url'); }
export function hashOpaqueToken(token: string) { return crypto.createHash('sha256').update(token).digest('hex'); }
