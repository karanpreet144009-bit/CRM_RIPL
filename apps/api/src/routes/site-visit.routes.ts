import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

export const siteVisitRouter = Router();
const createSchema = z.object({ leadId: z.string().uuid(), visitAt: z.coerce.date() });
const updateSchema = z.object({ status: z.enum(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(), feedback: z.string().trim().max(2000).nullable().optional(), checkIn: z.boolean().optional() }).refine(value => Object.keys(value).length > 0);
const managerRoles = ['SUPER_ADMIN', 'DIRECTOR', 'ADMIN', 'ADMINISTRATOR', 'SALES_MANAGER', 'CRM_EXECUTIVE'];
const canManage = (roles: string[]) => roles.some(role => managerRoles.includes(role));

siteVisitRouter.use(authenticate);
siteVisitRouter.post('/from-customer', async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({ customerId: z.string().uuid(), visitAt: z.coerce.date() }).parse(req.body);
    const employee = await prisma.employee.findUnique({ where: { userId: req.auth!.userId } });
    const data = await prisma.$transaction(async tx => {
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
      if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
      const existing = await tx.lead.findFirst({ where: { customerId: customer.id, deletedAt: null } });
      const lead = existing ?? await tx.lead.create({ data: { referenceNumber: `LEAD-${String((await tx.lead.count()) + 1).padStart(5, '0')}`, customerId: customer.id, customerName: customer.fullName, primaryPhone: customer.primaryPhone, email: customer.email, source: 'Existing customer', assignedEmployeeId: employee?.id } });
      const visit = await tx.siteVisit.create({ data: { leadId: lead.id, assignedEmployeeId: employee?.id, visitAt: input.visitAt } });
      await tx.lead.update({ where: { id: lead.id }, data: { status: 'SITE_VISIT_SCHEDULED' } });
      await tx.leadActivity.create({ data: { leadId: lead.id, action: 'SITE_VISIT_SCHEDULED', newValues: { visitAt: input.visitAt, customerId: customer.id } } });
      return visit;
    });
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
});
siteVisitRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { userId: req.auth!.userId } });
    const data = await prisma.siteVisit.findMany({ where: canManage(req.auth!.roles) ? {} : { assignedEmployeeId: employee?.id ?? '__unassigned__' }, include: { lead: { select: { customerName: true, referenceNumber: true, primaryPhone: true } } }, orderBy: { visitAt: 'asc' } });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
siteVisitRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const employee = await prisma.employee.findUnique({ where: { userId: req.auth!.userId } });
    const lead = await prisma.lead.findFirst({ where: { id: input.leadId, deletedAt: null, ...(canManage(req.auth!.roles) ? {} : { assignedEmployeeId: employee?.id ?? '__unassigned__' }) } });
    if (!lead) throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found or not assigned to you');
    const data = await prisma.$transaction(async tx => {
      const visit = await tx.siteVisit.create({ data: { leadId: lead.id, assignedEmployeeId: employee?.id, visitAt: input.visitAt } });
      await tx.lead.update({ where: { id: lead.id }, data: { status: 'SITE_VISIT_SCHEDULED' } });
      await tx.leadActivity.create({ data: { leadId: lead.id, action: 'SITE_VISIT_SCHEDULED', newValues: { visitAt: input.visitAt } } });
      if (employee?.userId) await tx.notification.upsert({ where: { dedupeKey: `site-visit-${visit.id}` }, update: {}, create: { dedupeKey: `site-visit-${visit.id}`, userId: employee.userId, type: 'SITE_VISIT', title: 'Site visit scheduled', message: `Visit with ${lead.customerName} is scheduled for ${input.visitAt.toLocaleString()}.`, link: '/site-visits' } });
      return visit;
    });
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
});
siteVisitRouter.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id); const input = updateSchema.parse(req.body);
    const employee = await prisma.employee.findUnique({ where: { userId: req.auth!.userId } });
    const visit = await prisma.siteVisit.findFirst({ where: { id, ...(canManage(req.auth!.roles) ? {} : { assignedEmployeeId: employee?.id ?? '__unassigned__' }) } });
    if (!visit) throw new AppError(404, 'SITE_VISIT_NOT_FOUND', 'Site visit not found');
    const data = await prisma.$transaction(async tx => {
      const updated = await tx.siteVisit.update({ where: { id }, data: { ...(input.status ? { status: input.status } : {}), ...(input.feedback !== undefined ? { feedback: input.feedback } : {}), ...(input.checkIn ? { checkedInAt: new Date() } : {}) } });
      await tx.leadActivity.create({ data: { leadId: visit.leadId, action: input.checkIn ? 'SITE_VISIT_CHECKED_IN' : 'SITE_VISIT_UPDATED', newValues: input } });
      return updated;
    });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
