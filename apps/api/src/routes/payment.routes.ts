import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

export const paymentRouter = Router();

const paymentSchema = z.object({ bookingId: z.string().uuid(), amount: z.coerce.number().positive(), paymentDate: z.coerce.date(), method: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER']) });
const scheduleSchema = z.object({ bookingId: z.string().uuid(), installmentName: z.string().trim().min(2).max(120), dueDate: z.coerce.date(), amount: z.coerce.number().positive(), gstRate: z.coerce.number().min(0).max(100).optional().default(0), lateInterestRate: z.coerce.number().min(0).max(100).optional().default(0), notes: z.string().trim().max(1000).optional().nullable() });
const scheduleUpdateSchema = z.object({ installmentName: z.string().trim().min(2).max(120).optional(), dueDate: z.coerce.date().optional(), amount: z.coerce.number().positive().optional(), gstRate: z.coerce.number().min(0).max(100).optional(), lateInterestRate: z.coerce.number().min(0).max(100).optional(), notes: z.string().trim().max(1000).optional().nullable(), status: z.enum(['PENDING', 'PAID', 'WAIVED', 'CANCELLED']).optional() });

const bookingInclude = { customer: true, property: { include: { project: true } } } as const;
const scheduleInclude = { booking: { include: bookingInclude } } as const;
const scheduleSummary = <T extends { status: string; dueDate: Date; amount: unknown; gstRate: unknown; lateInterestRate: unknown }>(schedule: T) => { const today = new Date(); today.setHours(0, 0, 0, 0); const daysLate = schedule.status === 'PENDING' && schedule.dueDate < today ? Math.floor((today.getTime() - schedule.dueDate.getTime()) / 86_400_000) : 0; const baseAmount = Number(schedule.amount); const gstAmount = baseAmount * Number(schedule.gstRate) / 100; const lateInterestAmount = daysLate ? (baseAmount + gstAmount) * Number(schedule.lateInterestRate) / 100 * daysLate / 365 : 0; return { effectiveStatus: daysLate ? 'OVERDUE' : schedule.status, daysLate, gstAmount, lateInterestAmount, totalDue: baseAmount + gstAmount + lateInterestAmount }; };

paymentRouter.use(authenticate);

paymentRouter.get('/', async (_req, res, next) => { try { const data = await prisma.payment.findMany({ include: { booking: { include: bookingInclude } }, orderBy: { paymentDate: 'desc' } }); res.json({ success: true, data }); } catch (error) { next(error); } });

paymentRouter.get('/schedules', async (_req, res, next) => {
  try {
    const schedules = await prisma.paymentSchedule.findMany({ include: scheduleInclude, orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }] });
    res.json({ success: true, data: schedules.map(schedule => ({ ...schedule, ...scheduleSummary(schedule) })) });
  } catch (error) { next(error); }
});

paymentRouter.get('/outstanding-report', async (_req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({ where: { status: { not: 'CANCELLED' } }, include: { customer: true, property: { include: { project: true } }, payments: true, paymentSchedules: true }, orderBy: { createdAt: 'desc' } });
    const data = bookings.map(booking => { const paid = booking.payments.reduce((sum, payment) => sum + Number(payment.amount), 0); const scheduledDue = booking.paymentSchedules.filter(item => item.status === 'PENDING').reduce((sum, item) => sum + scheduleSummary(item).totalDue, 0); return { bookingId: booking.id, referenceNumber: booking.referenceNumber, customer: booking.customer.fullName, unit: `${booking.property.project.name} · ${booking.property.unitNumber}`, propertyAmount: Number(booking.totalPropertyAmount), paid, outstanding: Math.max(0, Number(booking.totalPropertyAmount) - paid), scheduledDue }; });
    res.json({ success: true, data, totals: { outstanding: data.reduce((sum, item) => sum + item.outstanding, 0), scheduledDue: data.reduce((sum, item) => sum + item.scheduledDue, 0) } });
  } catch (error) { next(error); }
});

paymentRouter.post('/schedules', async (req: AuthRequest, res, next) => {
  try {
    const input = scheduleSchema.parse(req.body);
    const booking = await prisma.booking.findUnique({ where: { id: input.bookingId } });
    if (!booking || booking.status === 'CANCELLED') throw new AppError(422, 'INVALID_BOOKING', 'Select an active booking');
    const data = await prisma.paymentSchedule.create({ data: input, include: scheduleInclude });
    await prisma.auditLog.create({ data: { userId: req.auth!.userId, action: 'CREATE', entityType: 'PAYMENT_SCHEDULE', entityId: data.id, newValues: { bookingId: input.bookingId, installmentName: input.installmentName, amount: input.amount, dueDate: input.dueDate } } });
    res.status(201).json({ success: true, data: { ...data, ...scheduleSummary(data) } });
  } catch (error) { next(error); }
});

paymentRouter.patch('/schedules/:id', async (req: AuthRequest, res, next) => {
  try {
    const input = scheduleUpdateSchema.parse(req.body);
    const existing = await prisma.paymentSchedule.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Payment schedule not found');
    const data = await prisma.paymentSchedule.update({ where: { id: existing.id }, data: input, include: scheduleInclude });
    await prisma.auditLog.create({ data: { userId: req.auth!.userId, action: 'UPDATE', entityType: 'PAYMENT_SCHEDULE', entityId: data.id, oldValues: { status: existing.status, amount: existing.amount, dueDate: existing.dueDate }, newValues: input } });
    res.json({ success: true, data: { ...data, ...scheduleSummary(data) } });
  } catch (error) { next(error); }
});

paymentRouter.get('/receipts/:id', async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: String(req.params.id) }, include: { booking: { include: bookingInclude } } });
    if (!payment) throw new AppError(404, 'NOT_FOUND', 'Receipt not found');
    res.json({ success: true, data: { receiptNumber: payment.receiptNumber, paymentDate: payment.paymentDate, amount: payment.amount, method: payment.method, booking: payment.booking } });
  } catch (error) { next(error); }
});

paymentRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const input = paymentSchema.parse(req.body);
    const data = await prisma.$transaction(async tx => {
      const booking = await tx.booking.findUnique({ where: { id: input.bookingId }, include: { payments: true } });
      if (!booking || booking.status === 'CANCELLED') throw new AppError(422, 'INVALID_BOOKING', 'Select an active booking');
      const paid = booking.payments.reduce((sum, payment) => sum + Number(payment.amount), 0) + input.amount;
      const payment = await tx.payment.create({ data: { bookingId: booking.id, amount: input.amount, paymentDate: input.paymentDate, method: input.method, receiptNumber: `RCT-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}` } });
      const approved = booking.status === 'PENDING_APPROVAL';
      await tx.booking.update({ where: { id: booking.id }, data: { paymentStatus: paid >= Number(booking.totalPropertyAmount) ? 'PAID' : 'PARTIALLY_PAID', status: approved ? 'APPROVED' : booking.status } });
      if (approved) await tx.notification.upsert({ where: { dedupeKey: `booking-approved-${booking.id}` }, update: {}, create: { dedupeKey: `booking-approved-${booking.id}`, type: 'BOOKING_APPROVED', title: 'Booking approved', message: `${booking.referenceNumber} has been approved after payment entry.`, link: '/bookings' } });
      await tx.auditLog.create({ data: { userId: req.auth!.userId, action: 'CREATE', entityType: 'PAYMENT', entityId: payment.id, newValues: { bookingId: booking.id, amount: input.amount, receiptNumber: payment.receiptNumber } } });
      return payment;
    });
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
});
