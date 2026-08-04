import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

export const leadRouter = Router();
const managerRoles = ['SUPER_ADMIN', 'DIRECTOR', 'ADMIN', 'ADMINISTRATOR', 'SALES_MANAGER', 'CRM_EXECUTIVE'];
const leadStatus = z.enum(['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT_SCHEDULED', 'SITE_VISITED', 'NEGOTIATION', 'BOOKING_IN_PROGRESS', 'BOOKED', 'LOST', 'FUTURE_PROSPECT']);
const createSchema = z.object({ customerName: z.string().trim().min(2).max(120), primaryPhone: z.string().trim().min(8).max(20), email: z.string().email().optional().or(z.literal('')), source: z.string().trim().min(2).max(80), priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM') });
const updateSchema = z.object({ status: leadStatus.optional(), priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(), assignedEmployeeId: z.string().uuid().nullable().optional(), nextFollowUpAt: z.coerce.date().nullable().optional(), note: z.string().trim().min(1).max(2000).optional() }).refine(value => Object.keys(value).length > 0, 'At least one field is required');
const listSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25), search: z.string().trim().max(120).optional(), status: leadStatus.optional() });

function canManage(roles: string[]) { return roles.some(role => managerRoles.includes(role)); }
async function requesterEmployee(userId: string) { return prisma.employee.findUnique({ where: { userId } }); }
async function scopedLead(req: AuthRequest, leadId: string) {
  const employee = await requesterEmployee(req.auth!.userId);
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null, ...(canManage(req.auth!.roles) ? {} : { assignedEmployeeId: employee?.id ?? '__unassigned__' }) } });
  if (!lead) throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found or not assigned to you');
  return lead;
}

leadRouter.use(authenticate);

leadRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const input = listSchema.parse(req.query);
    const employee = await requesterEmployee(req.auth!.userId);
    const scope = canManage(req.auth!.roles) ? {} : { assignedEmployeeId: employee?.id ?? '__unassigned__' };
    const where = { deletedAt: null, ...scope, ...(input.status ? { status: input.status } : {}), ...(input.search ? { OR: [{ customerName: { contains: input.search, mode: 'insensitive' as const } }, { primaryPhone: { contains: input.search } }, { referenceNumber: { contains: input.search, mode: 'insensitive' as const } }] } : {}) };
    const [data, total] = await prisma.$transaction([prisma.lead.findMany({ where, include: { assignedEmployee: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'desc' }, skip: (input.page - 1) * input.pageSize, take: input.pageSize }), prisma.lead.count({ where })]);
    res.json({ success: true, data, meta: { page: input.page, pageSize: input.pageSize, total } });
  } catch (error) { next(error); }
});

leadRouter.get('/duplicate-check', async (req, res, next) => {
  try {
    const phone = z.string().trim().min(8).max(20).parse(req.query.phone);
    const [lead, customer] = await prisma.$transaction([
      prisma.lead.findFirst({ where: { primaryPhone: phone, deletedAt: null }, select: { id: true } }),
      prisma.customer.findFirst({ where: { primaryPhone: phone, deletedAt: null }, select: { id: true } }),
    ]);
    res.json({ success: true, data: { exists: Boolean(lead || customer) } });
  } catch (error) { next(error); }
});

leadRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const [duplicateLead, duplicateCustomer] = await prisma.$transaction([
      prisma.lead.findFirst({ where: { primaryPhone: input.primaryPhone, deletedAt: null }, select: { id: true } }),
      prisma.customer.findFirst({ where: { primaryPhone: input.primaryPhone, deletedAt: null }, select: { id: true } }),
    ]);
    if (duplicateLead || duplicateCustomer) throw new AppError(409, 'DUPLICATE_LEAD', 'This phone number already exists in lead or customer records');
    const employee = await requesterEmployee(req.auth!.userId);
    const count = await prisma.lead.count();
    const lead = await prisma.$transaction(async tx => {
      const created = await tx.lead.create({ data: { referenceNumber: `LEAD-${String(count + 1).padStart(5, '0')}`, customerName: input.customerName, primaryPhone: input.primaryPhone, email: input.email || null, source: input.source, priority: input.priority, assignedEmployeeId: employee?.id } });
      await tx.leadActivity.create({ data: { leadId: created.id, action: 'CREATED', newValues: { status: created.status, source: created.source } } });
      await tx.auditLog.create({ data: { userId: req.auth!.userId, action: 'CREATE', entityType: 'LEAD', entityId: created.id, newValues: { referenceNumber: created.referenceNumber } } });
      if (employee?.userId) await tx.notification.upsert({ where: { dedupeKey: `lead-assigned-${created.id}` }, update: {}, create: { dedupeKey: `lead-assigned-${created.id}`, userId: employee.userId, type: 'LEAD_ASSIGNED', title: 'New lead assigned', message: `${created.customerName} has been assigned to you.`, link: '/leads' } });
      return created;
    });
    res.status(201).json({ success: true, data: lead });
  } catch (error) { next(error); }
});

leadRouter.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const leadId = z.string().uuid().parse(req.params.id);
    const input = updateSchema.parse(req.body);
    const current = await scopedLead(req, leadId);
    if ((input.assignedEmployeeId !== undefined) && !canManage(req.auth!.roles)) throw new AppError(403, 'FORBIDDEN', 'Only a manager can assign leads');
    if (input.assignedEmployeeId) {
      const employee = await prisma.employee.findFirst({ where: { id: input.assignedEmployeeId, deletedAt: null } });
      if (!employee) throw new AppError(422, 'INVALID_EMPLOYEE', 'Assigned employee is not active');
    }
    const data = { ...(input.status ? { status: input.status } : {}), ...(input.priority ? { priority: input.priority } : {}), ...(input.assignedEmployeeId !== undefined ? { assignedEmployeeId: input.assignedEmployeeId } : {}), ...(input.nextFollowUpAt !== undefined ? { nextFollowUpAt: input.nextFollowUpAt } : {}) };
    const lead = await prisma.$transaction(async tx => {
      const updated = await tx.lead.update({ where: { id: current.id }, data, include: { assignedEmployee: { select: { id: true, fullName: true } } } });
      await tx.leadActivity.create({ data: { leadId: current.id, action: input.note ? 'NOTE_ADDED' : 'UPDATED', oldValues: { status: current.status, priority: current.priority, assignedEmployeeId: current.assignedEmployeeId }, newValues: { ...data, ...(input.note ? { note: input.note } : {}) } } });
      await tx.auditLog.create({ data: { userId: req.auth!.userId, action: 'UPDATE', entityType: 'LEAD', entityId: current.id, oldValues: { status: current.status, priority: current.priority }, newValues: data } });
      return updated;
    });
    res.json({ success: true, data: lead });
  } catch (error) { next(error); }
});

leadRouter.post('/:id/convert', async (req: AuthRequest, res, next) => {
  try {
    const lead = await scopedLead(req, z.string().uuid().parse(req.params.id));
    const customer = await prisma.$transaction(async tx => {
      const existing = await tx.customer.findFirst({ where: { primaryPhone: lead.primaryPhone, deletedAt: null } });
      const count = await tx.customer.count();
      const value = existing ?? await tx.customer.create({ data: { referenceNumber: `CUS-${String(count + 1).padStart(5, '0')}`, fullName: lead.customerName, primaryPhone: lead.primaryPhone, email: lead.email } });
      await tx.lead.update({ where: { id: lead.id }, data: { customerId: value.id } });
      await tx.leadActivity.create({ data: { leadId: lead.id, action: 'CONVERTED_TO_CUSTOMER', newValues: { customerId: value.id } } });
      await tx.auditLog.create({ data: { userId: req.auth!.userId, action: 'CONVERT', entityType: 'LEAD', entityId: lead.id, newValues: { customerId: value.id } } });
      return value;
    });
    res.status(201).json({ success: true, data: customer });
  } catch (error) { next(error); }
});
