import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize, type AuthRequest } from '../middleware/auth.js';

export const brokerRouter = Router();
const brokerInput = z.object({ fullName: z.string().trim().min(2).max(160), companyName: z.string().trim().max(160).optional().nullable(), phone: z.string().trim().min(8).max(20), email: z.string().trim().email().optional().or(z.literal('')).transform(v => v || null), reraNumber: z.string().trim().max(80).optional().nullable(), panNumber: z.string().trim().max(20).optional().nullable(), address: z.string().trim().max(500).optional().nullable() });
const ruleInput = z.object({ brokerId: z.string().uuid(), projectId: z.string().uuid().optional().nullable(), rateType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'), rate: z.coerce.number().positive(), notes: z.string().trim().max(1000).optional().nullable() });
const payoutInput = z.object({ brokerId: z.string().uuid(), bookingId: z.string().uuid().optional().nullable(), amount: z.coerce.number().positive(), reference: z.string().trim().max(120).optional().nullable(), notes: z.string().trim().max(1000).optional().nullable() });
brokerRouter.use(authenticate, authorize('ADMINISTRATOR', 'MANAGER'));
brokerRouter.get('/', async (_req, res, next) => { try {
  const [brokers, projects, bookings] = await Promise.all([
    prisma.broker.findMany({ where: { deletedAt: null }, include: {
      commissionRules: { include: { project: true }, orderBy: { createdAt: 'desc' } },
      payouts: { include: { booking: { include: { customer: true, property: { include: { project: true } } } } }, orderBy: { createdAt: 'desc' } }
    }, orderBy: { createdAt: 'desc' } }),
    prisma.project.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    prisma.booking.findMany({ where: { status: { in: ['APPROVED', 'CONFIRMED'] } }, include: { customer: true, property: { include: { project: true } } }, orderBy: { createdAt: 'desc' }, take: 100 })
  ]);
  res.json({ success: true, data: { brokers, projects, bookings } });
} catch (error) { next(error); } });
brokerRouter.post('/', async (req: AuthRequest, res, next) => { try { const input = brokerInput.parse(req.body); const total = await prisma.broker.count(); const data = await prisma.broker.create({ data: { ...input, code: `BRK-${String(total + 1).padStart(4, '0')}` } }); await prisma.auditLog.create({ data: { userId: req.auth!.userId, action: 'CREATE', entityType: 'BROKER', entityId: data.id, newValues: input } }); res.status(201).json({ success: true, data }); } catch (error) { next(error); } });
brokerRouter.post('/rules', async (req: AuthRequest, res, next) => { try { const input = ruleInput.parse(req.body); const data = await prisma.brokerCommissionRule.create({ data: input }); await prisma.auditLog.create({ data: { userId: req.auth!.userId, action: 'CREATE', entityType: 'BROKER_COMMISSION_RULE', entityId: data.id, newValues: input } }); res.status(201).json({ success: true, data }); } catch (error) { next(error); } });
brokerRouter.post('/payouts', async (req: AuthRequest, res, next) => { try { const input = payoutInput.parse(req.body); const data = await prisma.brokerPayout.create({ data: input }); await prisma.auditLog.create({ data: { userId: req.auth!.userId, action: 'CREATE', entityType: 'BROKER_PAYOUT', entityId: data.id, newValues: input } }); res.status(201).json({ success: true, data }); } catch (error) { next(error); } });
brokerRouter.patch('/payouts/:id', async (req: AuthRequest, res, next) => { try { const id = z.string().uuid().parse(req.params.id); const status = z.object({ status: z.enum(['PENDING', 'APPROVED', 'PAID', 'CANCELLED']), reference: z.string().trim().max(120).optional() }).parse(req.body); const data = await prisma.brokerPayout.update({ where: { id }, data: { ...status, paidAt: status.status === 'PAID' ? new Date() : undefined } }); await prisma.auditLog.create({ data: { userId: req.auth!.userId, action: 'UPDATE', entityType: 'BROKER_PAYOUT', entityId: id, newValues: status } }); res.json({ success: true, data }); } catch (error) { next(error); } });
