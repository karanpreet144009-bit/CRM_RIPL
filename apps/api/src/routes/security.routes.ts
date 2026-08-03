import { Router } from 'express';
import { env } from '../config/env.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
export const securityRouter = Router();
securityRouter.use(authenticate, authorize('ADMINISTRATOR'));
securityRouter.get('/overview', async (_req, res, next) => { try { const [roles, auditCount] = await Promise.all([prisma.role.findMany({ include: { permissions: { include: { permission: true } } }, orderBy: { name: 'asc' } }), prisma.auditLog.count()]); res.json({ success: true, data: { encryption: { passwords: 'bcrypt password hashing', sessions: 'signed JWT access and refresh tokens', transport: env.COOKIE_SECURE ? 'HTTPS secure cookies enabled' : 'Local office HTTPS recommended' }, ipRestriction: { enabled: Boolean(env.OFFICE_ALLOWED_IPS.trim()), allowedIps: env.OFFICE_ALLOWED_IPS.split(',').map(ip => ip.trim()).filter(Boolean) }, backup: { command: '.\\scripts\\backup-postgres.ps1', retentionDays: 30 }, auditLogCount: auditCount, roles: roles.map(role => ({ name: role.name, code: role.code, permissions: role.permissions.map(item => item.permission.code) })) } }); } catch (error) { next(error); } });
