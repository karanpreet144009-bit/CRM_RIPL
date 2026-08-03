import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const auditLogRouter = Router();
const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(50), entityType: z.enum(['LEAD', 'PROPERTY', 'BOOKING', 'PAYMENT', 'CUSTOMER', 'CUSTOMER_DOCUMENT']).optional() });

auditLogRouter.use(authenticate, authorize('ADMINISTRATOR'));
auditLogRouter.get('/', async (req, res, next) => {
  try {
    const input = querySchema.parse(req.query);
    const where = { ...(input.entityType ? { entityType: input.entityType } : {}) };
    const [data, total] = await prisma.$transaction([
      prisma.auditLog.findMany({ where, include: { user: { include: { employee: { select: { fullName: true } } } } }, orderBy: { createdAt: 'desc' }, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ success: true, data: data.map((record) => ({ id: record.id, action: record.action, entityType: record.entityType, entityId: record.entityId, oldValues: record.oldValues, newValues: record.newValues, createdAt: record.createdAt, actor: record.user?.employee?.fullName ?? record.user?.email ?? 'System' })), meta: { page: input.page, pageSize: input.pageSize, total } });
  } catch (error) { next(error); }
});
