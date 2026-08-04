import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

export const leaveRouter = Router();
const leaveInput = z.object({ leaveType: z.enum(['CASUAL_LEAVE', 'SICK_LEAVE', 'EARNED_LEAVE', 'UNPAID_LEAVE', 'OTHER']), startDate: z.coerce.date(), endDate: z.coerce.date(), reason: z.string().trim().min(3).max(1000) });

leaveRouter.use(authenticate);
leaveRouter.get('/my', async (req: AuthRequest, res, next) => {
  try {
    const employee = await prisma.employee.findFirst({ where: { userId: req.auth!.userId, deletedAt: null }, select: { id: true } });
    if (!employee) return res.json({ success: true, data: [] });
    const data = await prisma.leaveRequest.findMany({ where: { employeeId: employee.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
leaveRouter.post('/my', async (req: AuthRequest, res, next) => {
  try {
    const input = leaveInput.parse(req.body);
    if (input.endDate < input.startDate) throw new AppError(422, 'INVALID_LEAVE_DATES', 'End date cannot be before start date');
    const employee = await prisma.employee.findFirst({ where: { userId: req.auth!.userId, deletedAt: null }, select: { id: true } });
    if (!employee) throw new AppError(403, 'EMPLOYEE_REQUIRED', 'Only employee accounts can request leave');
    const data = await prisma.$transaction(async (tx) => {
      const created = await tx.leaveRequest.create({ data: { employeeId: employee.id, ...input } });
      await tx.auditLog.create({ data: { userId: req.auth!.userId, action: 'CREATE', entityType: 'LEAVE_REQUEST', entityId: created.id, newValues: input } });
      return created;
    });
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
});
leaveRouter.patch('/:id/review', authorize('ADMINISTRATOR', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id); const input = z.object({ status: z.enum(['APPROVED', 'REJECTED']) }).parse(req.body);
    const data = await prisma.leaveRequest.update({ where: { id }, data: { status: input.status, reviewedById: req.auth!.userId, reviewedAt: new Date() } });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
