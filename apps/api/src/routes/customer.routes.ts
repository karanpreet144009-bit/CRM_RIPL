import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

export const customerRouter = Router();
const customerBaseSchema = z.object({ fullName: z.string().trim().min(2).max(120), primaryPhone: z.string().trim().min(8).max(20), email: z.string().trim().email().optional().or(z.literal('')), remarks: z.string().trim().max(2000).optional().or(z.literal('')), familyDetails: z.string().trim().max(4000).optional().or(z.literal('')), budgetMin: z.coerce.number().min(0).max(999999999999).optional(), budgetMax: z.coerce.number().min(0).max(999999999999).optional(), preferences: z.string().trim().max(4000).optional().or(z.literal('')) });
const customerSchema = customerBaseSchema.refine(value => value.budgetMin === undefined || value.budgetMax === undefined || value.budgetMin <= value.budgetMax, { message: 'Minimum budget cannot exceed maximum budget', path: ['budgetMax'] });
const communicationSchema = z.object({ channel: z.enum(['CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'SMS', 'OTHER']), direction: z.enum(['INBOUND', 'OUTBOUND']), summary: z.string().trim().min(2).max(2000), occurredAt: z.coerce.date().optional() });
const listSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25), search: z.string().trim().max(120).optional() });

customerRouter.use(authenticate);
customerRouter.get('/', async (req, res, next) => {
  try {
    const input = listSchema.parse(req.query);
    const where = { deletedAt: null, ...(input.search ? { OR: [{ fullName: { contains: input.search, mode: 'insensitive' as const } }, { primaryPhone: { contains: input.search } }, { referenceNumber: { contains: input.search, mode: 'insensitive' as const } }] } : {}) };
    const [data, total] = await prisma.$transaction([prisma.customer.findMany({ where, include: { _count: { select: { leads: true, bookings: true } } }, orderBy: { createdAt: 'desc' }, skip: (input.page - 1) * input.pageSize, take: input.pageSize }), prisma.customer.count({ where })]);
    res.json({ success: true, data, meta: { page: input.page, pageSize: input.pageSize, total } });
  } catch (error) { next(error); }
});
customerRouter.get('/:id', async (req, res, next) => {
  try {
    const customerId = z.string().uuid().parse(req.params.id);
    const data = await prisma.customer.findFirst({ where: { id: customerId, deletedAt: null }, include: { leads: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } }, bookings: { include: { property: { include: { project: true } }, payments: true }, orderBy: { createdAt: 'desc' } }, communications: { orderBy: { occurredAt: 'desc' }, take: 100 } } });
    if (!data) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
customerRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const input = customerSchema.parse(req.body);
    const duplicate = await prisma.customer.findFirst({ where: { primaryPhone: input.primaryPhone, deletedAt: null } });
    if (duplicate) throw new AppError(409, 'DUPLICATE_CUSTOMER', 'A customer already uses this phone number');
    const count = await prisma.customer.count();
    const data = await prisma.$transaction(async tx => {
      const created = await tx.customer.create({ data: { referenceNumber: `CUS-${String(count + 1).padStart(5, '0')}`, fullName: input.fullName, primaryPhone: input.primaryPhone, email: input.email || null, remarks: input.remarks || null, familyDetails: input.familyDetails || null, budgetMin: input.budgetMin, budgetMax: input.budgetMax, preferences: input.preferences || null } });
      await tx.auditLog.create({ data: { userId: req.auth!.userId, action: 'CREATE', entityType: 'CUSTOMER', entityId: created.id, newValues: { referenceNumber: created.referenceNumber } } });
      return created;
    });
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
});
customerRouter.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const customerId = z.string().uuid().parse(req.params.id);
    const input = customerBaseSchema.partial().refine(value => Object.keys(value).length > 0, 'At least one field is required').parse(req.body);
    const current = await prisma.customer.findFirst({ where: { id: customerId, deletedAt: null } });
    if (!current) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
    const data = await prisma.$transaction(async tx => {
      const updated = await tx.customer.update({ where: { id: current.id }, data: { ...input, ...(input.email === '' ? { email: null } : {}), ...(input.remarks === '' ? { remarks: null } : {}), ...(input.familyDetails === '' ? { familyDetails: null } : {}), ...(input.preferences === '' ? { preferences: null } : {}) } });
      await tx.auditLog.create({ data: { userId: req.auth!.userId, action: 'UPDATE', entityType: 'CUSTOMER', entityId: current.id, oldValues: { fullName: current.fullName, email: current.email }, newValues: input } });
      return updated;
    });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
customerRouter.post('/:id/communications', async (req: AuthRequest, res, next) => {
  try {
    const customerId = z.string().uuid().parse(req.params.id); const input = communicationSchema.parse(req.body);
    const customer = await prisma.customer.findFirst({ where: { id: customerId, deletedAt: null } }); if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
    const data = await prisma.customerCommunication.create({ data: { customerId, createdById: req.auth!.userId, ...input } });
    await prisma.auditLog.create({ data: { userId: req.auth!.userId, action: 'CREATE', entityType: 'CUSTOMER_COMMUNICATION', entityId: data.id, newValues: { customerId, channel: data.channel, direction: data.direction } } });
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
});
