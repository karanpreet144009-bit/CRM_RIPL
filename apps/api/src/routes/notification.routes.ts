import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

export const notificationRouter = Router();
async function ensureOperationalNotifications() {
  const now = new Date();
  const dueFollowUps = await prisma.followUp.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: now } }, include: { lead: true }, take: 50 });
  const employees = dueFollowUps.length ? await prisma.employee.findMany({ where: { id: { in: dueFollowUps.map((item) => item.assignedEmployeeId).filter(Boolean) as string[] } }, select: { id: true, userId: true } }) : [];
  const employeeUsers = new Map(employees.map((employee) => [employee.id, employee.userId]));
  for (const item of dueFollowUps) await prisma.notification.upsert({ where: { dedupeKey: `follow-up-due-${item.id}` }, update: {}, create: { dedupeKey: `follow-up-due-${item.id}`, userId: item.assignedEmployeeId ? employeeUsers.get(item.assignedEmployeeId) : null, type: 'FOLLOW_UP_DUE', title: 'Follow-up due', message: `Follow up with ${item.lead.customerName} is due.`, link: '/follow-ups' } });
  const pendingBookings = await prisma.booking.findMany({ where: { paymentStatus: { in: ['PENDING', 'PARTIALLY_PAID'] }, status: { not: 'CANCELLED' } }, include: { customer: true }, take: 50 });
  for (const booking of pendingBookings) await prisma.notification.upsert({ where: { dedupeKey: `payment-due-${booking.id}` }, update: {}, create: { dedupeKey: `payment-due-${booking.id}`, type: 'PAYMENT_DUE', title: 'Payment due', message: `Payment is pending for ${booking.referenceNumber} (${booking.customer.fullName}).`, link: '/payments' } });
  const schedules = await prisma.paymentSchedule.findMany({ where: { status: 'PENDING', dueDate: { lte: now } }, include: { booking: { include: { customer: true, property: { include: { project: true } } } } }, take: 100 });
  for (const schedule of schedules) {
    const overdue = schedule.dueDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());
    await prisma.notification.upsert({ where: { dedupeKey: `schedule-${overdue ? 'late' : 'due'}-${schedule.id}` }, update: {}, create: { dedupeKey: `schedule-${overdue ? 'late' : 'due'}-${schedule.id}`, type: overdue ? 'LATE_PAYMENT_ALERT' : 'PAYMENT_DUE_REMINDER', title: overdue ? 'Late payment alert' : 'Payment due reminder', message: `${schedule.installmentName} for ${schedule.booking.customer.fullName} (${schedule.booking.property.project.name} · ${schedule.booking.property.unitNumber}) is ${overdue ? 'overdue' : 'due today'}.`, link: '/payments' } });
  }
  const emiWindow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const upcomingEmis = await prisma.paymentSchedule.findMany({ where: { status: 'PENDING', dueDate: { gt: now, lte: emiWindow } }, include: { booking: { include: { customer: true } } }, take: 100 });
  for (const item of upcomingEmis) await prisma.notification.upsert({ where: { dedupeKey: `emi-reminder-${item.id}` }, update: {}, create: { dedupeKey: `emi-reminder-${item.id}`, type: 'EMI_REMINDER', title: 'EMI reminder', message: `${item.installmentName} for ${item.booking.customer.fullName} is due on ${item.dueDate.toLocaleDateString('en-IN')}.`, link: '/payments' } });
  const visitWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const upcomingVisits = await prisma.siteVisit.findMany({ where: { status: { in: ['SCHEDULED', 'CONFIRMED'] }, visitAt: { gte: now, lte: visitWindow } }, include: { lead: true }, take: 100 });
  for (const visit of upcomingVisits) await prisma.notification.upsert({ where: { dedupeKey: `site-visit-reminder-${visit.id}` }, update: {}, create: { dedupeKey: `site-visit-reminder-${visit.id}`, type: 'SITE_VISIT_REMINDER', title: 'Site visit reminder', message: `Site visit with ${visit.lead.customerName} is scheduled for ${visit.visitAt.toLocaleString('en-IN')}.`, link: '/site-visits' } });
  const confirmedBookings = await prisma.booking.findMany({ where: { status: { in: ['APPROVED', 'CONFIRMED'] } }, include: { customer: true, property: { include: { project: true } }, documents: true }, take: 100 });
  for (const booking of confirmedBookings) {
    await prisma.notification.upsert({ where: { dedupeKey: `booking-confirmation-${booking.id}` }, update: {}, create: { dedupeKey: `booking-confirmation-${booking.id}`, type: 'BOOKING_CONFIRMATION', title: 'Booking confirmation', message: `${booking.referenceNumber} for ${booking.customer.fullName} is confirmed.`, link: '/bookings' } });
    if (booking.documents.length === 0) await prisma.notification.upsert({ where: { dedupeKey: `document-pending-${booking.id}` }, update: {}, create: { dedupeKey: `document-pending-${booking.id}`, type: 'DOCUMENT_PENDING', title: 'Booking document pending', message: `Upload agreement/KYC documents for ${booking.referenceNumber} (${booking.customer.fullName}).`, link: '/documents' } });
    if (booking.paymentStatus === 'PAID') await prisma.notification.upsert({ where: { dedupeKey: `possession-update-${booking.id}` }, update: {}, create: { dedupeKey: `possession-update-${booking.id}`, type: 'POSSESSION_UPDATE', title: 'Possession follow-up', message: `${booking.referenceNumber} is fully paid. Prepare possession and handover update for ${booking.customer.fullName}.`, link: '/bookings' } });
  }
}
notificationRouter.use(authenticate);
notificationRouter.get('/', async (req: AuthRequest, res, next) => { try { await ensureOperationalNotifications(); const data = await prisma.notification.findMany({ where: { OR: [{ userId: req.auth!.userId }, { userId: null }] }, orderBy: { createdAt: 'desc' }, take: 100 }); res.json({ success: true, data }); } catch (error) { next(error); } });
notificationRouter.post('/:id/read', async (req: AuthRequest, res, next) => { try { const id = z.string().uuid().parse(req.params.id); const record = await prisma.notification.findFirst({ where: { id, OR: [{ userId: req.auth!.userId }, { userId: null }] } }); if (!record) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found'); const data = await prisma.notification.update({ where: { id }, data: { readAt: new Date() } }); res.json({ success: true, data }); } catch (error) { next(error); } });
