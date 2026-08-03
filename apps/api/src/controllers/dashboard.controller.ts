import type { NextFunction, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthRequest } from '../middleware/auth.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const salesTargetSchema = z.object({ amount: z.coerce.number().positive().max(999999999999) });
const currentMonth = () => { const now = new Date(); return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)); };

export async function overview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const employee = await prisma.employee.findUnique({ where: { userId: req.auth!.userId }, select: { id: true } });
    const restricted = req.auth!.roles.includes('SALES_EXECUTIVE');
    const assignedEmployeeId = restricted ? employee?.id : undefined;
    const leadScope = assignedEmployeeId ? { assignedEmployeeId } : {};
    const [activeLeads, newLeadsToday, pendingFollowUps, overdueFollowUps, visitsToday, availableProperties, reservedProperties, bookedProperties, activeEmployees] = await Promise.all([
      prisma.lead.count({ where: { ...leadScope, deletedAt: null, status: { notIn: ['LOST', 'BOOKED'] } } }),
      prisma.lead.count({ where: { ...leadScope, deletedAt: null, createdAt: { gte: today, lt: tomorrow } } }),
      prisma.followUp.count({ where: { status: 'SCHEDULED', scheduledAt: { gte: today, lt: tomorrow }, ...(assignedEmployeeId ? { assignedEmployeeId } : {}) } }),
      prisma.followUp.count({ where: { status: 'SCHEDULED', scheduledAt: { lt: today }, ...(assignedEmployeeId ? { assignedEmployeeId } : {}) } }),
      prisma.siteVisit.count({ where: { visitAt: { gte: today, lt: tomorrow }, status: { in: ['SCHEDULED', 'CONFIRMED'] }, ...(assignedEmployeeId ? { assignedEmployeeId } : {}) } }),
      prisma.property.count({ where: { deletedAt: null, status: 'AVAILABLE' } }),
      prisma.property.count({ where: { deletedAt: null, status: 'RESERVED' } }),
      prisma.property.count({ where: { deletedAt: null, status: 'BOOKED' } }),
      prisma.employee.count({ where: { deletedAt: null, user: { status: 'ACTIVE' } } }),
    ]);
    res.json({ success: true, data: { activeLeads, newLeadsToday, pendingFollowUps, overdueFollowUps, visitsToday, availableProperties, reservedProperties, bookedProperties, activeEmployees } });
  } catch (error) { next(error); }
}

export async function salesOverview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1); const monthStart = currentMonth();
    const employee = await prisma.employee.findUnique({ where: { userId: req.auth!.userId }, select: { id: true } }); const restricted = req.auth!.roles.includes('SALES_EXECUTIVE');
    const bookingScope = restricted ? { lead: { assignedEmployeeId: employee?.id } } : {};
    const [bookings, payments, totalLeads, bookedLeads] = await Promise.all([
      prisma.booking.findMany({ where: { bookingDate: { gte: monthStart }, status: { in: ['APPROVED', 'CONFIRMED'] }, ...bookingScope }, include: { property: { include: { project: true } }, lead: { include: { assignedEmployee: true } } } }),
      prisma.payment.findMany({ where: { paymentDate: { gte: monthStart }, booking: bookingScope }, include: { booking: { include: { property: { include: { project: true } }, lead: { include: { assignedEmployee: true } } } } } }),
      prisma.lead.count({ where: { deletedAt: null, ...(restricted ? { assignedEmployeeId: employee?.id } : {}) } }),
      prisma.lead.count({ where: { deletedAt: null, status: 'BOOKED', ...(restricted ? { assignedEmployeeId: employee?.id } : {}) } }),
    ]);
    const value = (items: { amount?: unknown; bookingAmount?: unknown }[], key: 'amount' | 'bookingAmount') => items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0);
    const revenue = value(payments, 'amount'); const monthlySales = value(bookings, 'bookingAmount');
    const dailySales = payments.filter(payment => payment.paymentDate >= today && payment.paymentDate < tomorrow).reduce((sum, payment) => sum + Number(payment.amount), 0);
    const projectMap = new Map<string, { project: string; bookings: number; value: number; revenue: number }>();
    bookings.forEach(booking => { const key = booking.property.project.id; const item = projectMap.get(key) ?? { project: booking.property.project.name, bookings: 0, value: 0, revenue: 0 }; item.bookings += 1; item.value += Number(booking.bookingAmount); projectMap.set(key, item); });
    payments.forEach(payment => { const key = payment.booking.property.project.id; const item = projectMap.get(key) ?? { project: payment.booking.property.project.name, bookings: 0, value: 0, revenue: 0 }; item.revenue += Number(payment.amount); projectMap.set(key, item); });
    const agentMap = new Map<string, { agent: string; bookings: number; bookingValue: number; revenue: number }>();
    bookings.forEach(booking => { const employeeName = booking.lead?.assignedEmployee?.fullName ?? 'Unassigned'; const item = agentMap.get(employeeName) ?? { agent: employeeName, bookings: 0, bookingValue: 0, revenue: 0 }; item.bookings += 1; item.bookingValue += Number(booking.bookingAmount); agentMap.set(employeeName, item); });
    payments.forEach(payment => { const employeeName = payment.booking.lead?.assignedEmployee?.fullName ?? 'Unassigned'; const item = agentMap.get(employeeName) ?? { agent: employeeName, bookings: 0, bookingValue: 0, revenue: 0 }; item.revenue += Number(payment.amount); agentMap.set(employeeName, item); });
    const bookingTrends = Array.from({ length: now.getDate() }, (_, index) => { const day = new Date(monthStart); day.setDate(index + 1); const next = new Date(day); next.setDate(next.getDate() + 1); const dayBookings = bookings.filter(booking => booking.bookingDate >= day && booking.bookingDate < next); return { label: String(index + 1), bookings: dayBookings.length, value: value(dayBookings, 'bookingAmount') }; });
    const targets = await prisma.$queryRaw<{ amount: unknown }[]>`SELECT "amount" FROM "SalesTarget" WHERE "month" = ${monthStart} LIMIT 1`;
    res.json({ success: true, data: { dailySales, monthlySales, monthlyTarget: Number(targets[0]?.amount ?? 0), revenue, conversionRate: totalLeads ? Number(((bookedLeads / totalLeads) * 100).toFixed(1)) : 0, bookingTrends, agentPerformance: [...agentMap.values()].sort((a, b) => b.bookingValue - a.bookingValue), projectWiseSales: [...projectMap.values()].sort((a, b) => b.value - a.value) } });
  } catch (error) { next(error); }
}

export async function setMonthlySalesTarget(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = salesTargetSchema.parse(req.body); const month = currentMonth();
    const targets = await prisma.$queryRaw<{ id: string }[]>`INSERT INTO "SalesTarget" ("id", "month", "amount", "createdAt", "updatedAt") VALUES (CAST(${randomUUID()} AS uuid), ${month}, ${input.amount}, NOW(), NOW()) ON CONFLICT ("month") DO UPDATE SET "amount" = EXCLUDED."amount", "updatedAt" = NOW() RETURNING "id"`;
    await prisma.auditLog.create({ data: { userId: req.auth!.userId, action: 'SET_MONTHLY_SALES_TARGET', entityType: 'SALES_TARGET', entityId: targets[0]!.id, newValues: { amount: input.amount, month } } });
    res.json({ success: true, data: { amount: input.amount, month } });
  } catch (error) { next(error); }
}
