import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

export const propertyRouter = Router();
const managerRoles = ['SUPER_ADMIN', 'DIRECTOR', 'ADMIN', 'ADMINISTRATOR', 'MANAGER', 'SALES_MANAGER'];
const propertyStatus = z.enum([
  'AVAILABLE',
  'LEAD_ASSIGNED',
  'IN_DISCUSSION',
  'FOLLOW_UP_ACTIVE',
  'SITE_VISIT_SCHEDULED',
  'PRICE_NEGOTIATION',
  'HOLD',
  'RESERVED',
  'TOKEN_RECEIVED',
  'BOOKING_IN_PROGRESS',
  'BOOKED',
  'SOLD',
  'MANAGEMENT_BLOCKED',
  'BLOCKED',
  'CANCELLED',
]);
const schema = z.object({
  projectName: z.string().trim().min(2),
  projectCode: z.string().trim().toUpperCase().min(2).max(20),
  location: z.string().trim().min(1).max(80),
  unitNumber: z.string().trim().min(1).max(30),
  type: z.enum(['FLAT', 'SHOP', 'OFFICE']),
  basePrice: z.coerce.number().positive(),
  finalPrice: z.coerce.number().positive(),
  status: propertyStatus.default('AVAILABLE'),
  dealingExecutiveId: z.string().uuid().optional().nullable(),
});
const discussionSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(8).max(20),
  leadId: z.string().uuid().optional().nullable(),
  durationHours: z.coerce.number().int().min(1).max(168).default(48),
});
const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
const statusUpdateSchema = z.object({ status: propertyStatus, customerName: z.string().trim().min(2).max(120).optional(), customerPhone: z.string().trim().min(8).max(20).optional() });
const talkCustomerSchema = z.object({ customerName: z.string().trim().min(2).max(120).nullable(), customerPhone: z.string().trim().min(8).max(20).nullable().optional() });
const updateSchema = z.object({ projectName: z.string().trim().min(2).optional(), projectCode: z.string().trim().toUpperCase().min(2).max(20).optional(), location: z.string().trim().min(1).max(80).optional(), unitNumber: z.string().trim().min(1).max(30).optional(), type: z.enum(['FLAT', 'SHOP', 'OFFICE']).optional(), basePrice: z.coerce.number().positive().optional(), finalPrice: z.coerce.number().positive().optional(), dealingExecutiveId: z.string().uuid().nullable().optional() }).refine((value) => Object.keys(value).length > 0, 'At least one field is required');
const transferSchema = z.object({
  employeeId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
  durationHours: z.coerce.number().int().min(1).max(168).optional(),
});
function isManager(roles: string[]) {
  return roles.some((role) => managerRoles.includes(role));
}
async function expireDiscussionLocks() {
  const expired = await prisma.property.findMany({
    where: { status: { in: ['LEAD_ASSIGNED', 'IN_DISCUSSION', 'FOLLOW_UP_ACTIVE', 'SITE_VISIT_SCHEDULED', 'PRICE_NEGOTIATION'] }, lockExpiresAt: { lte: new Date() }, deletedAt: null },
    select: {
      id: true,
      status: true,
      lockOwnerEmployeeId: true,
      lockLeadId: true,
      lockCustomerName: true,
      lockCustomerPhone: true,
      lockExpiresAt: true,
    },
  });
  if (!expired.length) return;
  await prisma.$transaction(async (tx) => {
    for (const unit of expired) {
      const updated = await tx.property.updateMany({
        where: { id: unit.id, status: { in: ['LEAD_ASSIGNED', 'IN_DISCUSSION', 'FOLLOW_UP_ACTIVE', 'SITE_VISIT_SCHEDULED', 'PRICE_NEGOTIATION'] }, lockExpiresAt: { lte: new Date() } },
        data: {
          status: 'AVAILABLE',
          lockOwnerEmployeeId: null,
          lockLeadId: null,
          lockCustomerName: null,
          lockCustomerPhone: null,
          lockStartedAt: null,
          lockExpiresAt: null,
        },
      });
      if (updated.count)
        await tx.unitLockHistory.create({
          data: {
            propertyId: unit.id,
            action: 'DISCUSSION_EXPIRED',
            previousStatus: unit.status,
            newStatus: 'AVAILABLE',
            assignedEmployeeId: unit.lockOwnerEmployeeId,
            leadId: unit.lockLeadId,
            customerName: unit.lockCustomerName,
            customerPhone: unit.lockCustomerPhone,
            expiresAt: unit.lockExpiresAt,
            reason: 'Discussion expired automatically',
          },
        });
    }
  });
}
async function currentEmployee(userId: string) {
  return prisma.employee.findUnique({ where: { userId } });
}

propertyRouter.use(authenticate);
propertyRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    await expireDiscussionLocks();
    const records = await prisma.property.findMany({
      where: { deletedAt: null },
      include: { project: true },
      orderBy: { createdAt: 'desc' },
    });
    const employeeIds = records.flatMap((record) => [record.lockOwnerEmployeeId, record.dealingExecutiveId]).filter(Boolean) as string[];
    const employees = employeeIds.length ? await prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, fullName: true } }) : [];
    const employeeById = new Map(employees.map((employee) => [employee.id, employee.fullName]));
    const employee = await currentEmployee(req.auth!.userId);
    const canSeeCustomer = isManager(req.auth!.roles);
    res.json({ success: true, data: records.map((record) => {
      const ownsLock = record.lockOwnerEmployeeId === employee?.id;
      return { ...record, lockCustomerName: canSeeCustomer || ownsLock ? record.lockCustomerName : null, lockCustomerPhone: canSeeCustomer || ownsLock ? record.lockCustomerPhone : null, handlingExecutiveName: record.lockOwnerEmployeeId ? employeeById.get(record.lockOwnerEmployeeId) ?? null : null, dealingExecutiveName: record.dealingExecutiveId ? employeeById.get(record.dealingExecutiveId) ?? null : null };
    }) });
  } catch (error) {
    next(error);
  }
});
propertyRouter.get('/:id/history', async (req, res, next) => {
  try {
    const propertyId = z.string().uuid().parse(req.params.id);
    const data = await prisma.unitLockHistory.findMany({ where: { propertyId }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
propertyRouter.get('/:id/suggestions', async (req, res, next) => {
  try {
    await expireDiscussionLocks();
    const unit = await prisma.property.findFirst({
      where: { id: z.string().uuid().parse(req.params.id), deletedAt: null },
    });
    if (!unit) throw new AppError(404, 'UNIT_NOT_FOUND', 'Unit not found');
    const data = await prisma.property.findMany({
      where: { projectId: unit.projectId, type: unit.type, status: 'AVAILABLE', deletedAt: null, id: { not: unit.id } },
      include: { project: true },
      take: 6,
      orderBy: { unitNumber: 'asc' },
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
propertyRouter.post(
  '/',
  authorize('ADMINISTRATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const input = schema.parse(req.body);
      const project = await prisma.project.upsert({
        where: { code: input.projectCode },
        update: { name: input.projectName, location: input.location },
        create: { code: input.projectCode, name: input.projectName, location: input.location, status: 'ACTIVE' },
      });
      const existing = await prisma.property.findUnique({
        where: { projectId_unitNumber: { projectId: project.id, unitNumber: input.unitNumber } },
      });
      if (existing) throw new AppError(409, 'UNIT_EXISTS', 'This unit number already exists in the selected project');
      const count = await prisma.property.count();
      const record = await prisma.property.create({
        data: {
          referenceNumber: `PROP-${String(count + 1).padStart(5, '0')}`,
          projectId: project.id,
          unitNumber: input.unitNumber,
          type: input.type,
          basePrice: input.basePrice,
          finalPrice: input.finalPrice,
          status: input.status,
          dealingExecutiveId: input.dealingExecutiveId || null,
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: req.auth!.userId,
          action: 'CREATE_PROPERTY',
          entityType: 'PROPERTY',
          entityId: record.id,
          newValues: { referenceNumber: record.referenceNumber },
        },
      });
      res.status(201).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  },
);
propertyRouter.patch('/:id/status', authorize('ADMINISTRATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id); const input = statusUpdateSchema.parse(req.body);
    const current = await prisma.property.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new AppError(404, 'UNIT_NOT_FOUND', 'Unit not found');
    const clearsHandling = input.status !== 'IN_DISCUSSION';
    const data = await prisma.property.update({ where: { id }, data: { status: input.status, ...(input.status === 'IN_DISCUSSION' ? { lockCustomerName: input.customerName, lockCustomerPhone: input.customerPhone || null, lockStartedAt: new Date() } : {}), ...(clearsHandling ? { lockOwnerEmployeeId: null, lockLeadId: null, lockCustomerName: null, lockCustomerPhone: null, lockStartedAt: null, lockExpiresAt: null } : {}) }, include: { project: true } });
    await prisma.auditLog.create({ data: { userId: req.auth!.userId, action: 'UPDATE_PROPERTY_STATUS', entityType: 'PROPERTY', entityId: id, oldValues: { status: current.status }, newValues: { status: input.status } } });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
propertyRouter.patch('/:id/talk-customer', authorize('ADMINISTRATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id); const input = talkCustomerSchema.parse(req.body);
    const current = await prisma.property.findFirst({ where: { id, deletedAt: null } }); if (!current) throw new AppError(404, 'UNIT_NOT_FOUND', 'Unit not found');
    const data = await prisma.property.update({ where: { id }, data: { lockCustomerName: input.customerName, lockCustomerPhone: input.customerName ? input.customerPhone || null : null } });
    await prisma.auditLog.create({ data: { userId: req.auth!.userId, action: input.customerName ? 'UPDATE_TALK_CUSTOMER' : 'REMOVE_TALK_CUSTOMER', entityType: 'PROPERTY', entityId: id, newValues: { customerName: input.customerName } } });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
propertyRouter.patch('/:id', authorize('ADMINISTRATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id); const input = updateSchema.parse(req.body);
    const current = await prisma.property.findFirst({ where: { id, deletedAt: null }, include: { project: true } });
    if (!current) throw new AppError(404, 'UNIT_NOT_FOUND', 'Unit not found');
    const projectCode = input.projectCode ?? current.project.code;
    const project = await prisma.project.upsert({ where: { code: projectCode }, update: { ...(input.projectName ? { name: input.projectName } : {}), ...(input.location ? { location: input.location } : {}) }, create: { code: projectCode, name: input.projectName ?? current.project.name, location: input.location ?? current.project.location, status: 'ACTIVE' } });
    const unitNumber = input.unitNumber ?? current.unitNumber;
    const duplicate = await prisma.property.findFirst({ where: { id: { not: id }, projectId: project.id, unitNumber, deletedAt: null } });
    if (duplicate) throw new AppError(409, 'UNIT_EXISTS', 'This unit number already exists in the selected project');
    const data = await prisma.property.update({ where: { id }, data: { projectId: project.id, unitNumber, ...(input.type ? { type: input.type } : {}), ...(input.basePrice ? { basePrice: input.basePrice } : {}), ...(input.finalPrice ? { finalPrice: input.finalPrice } : {}), ...(input.dealingExecutiveId !== undefined ? { dealingExecutiveId: input.dealingExecutiveId } : {}) }, include: { project: true } });
    await prisma.auditLog.create({ data: { userId: req.auth!.userId, action: 'UPDATE_PROPERTY', entityType: 'PROPERTY', entityId: id, oldValues: { unitNumber: current.unitNumber, projectCode: current.project.code, finalPrice: current.finalPrice }, newValues: input } });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
propertyRouter.delete('/:id', authorize('ADMINISTRATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id); const current = await prisma.property.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new AppError(404, 'UNIT_NOT_FOUND', 'Unit not found');
    const activeBooking = await prisma.booking.findFirst({ where: { propertyId: id, status: { not: 'CANCELLED' } } });
    if (activeBooking) throw new AppError(409, 'PROPERTY_HAS_BOOKING', 'A property with an active booking cannot be deleted');
    await prisma.$transaction(async (tx) => { await tx.property.update({ where: { id }, data: { deletedAt: new Date() } }); await tx.auditLog.create({ data: { userId: req.auth!.userId, action: 'DELETE_PROPERTY', entityType: 'PROPERTY', entityId: id, oldValues: { referenceNumber: current.referenceNumber, unitNumber: current.unitNumber } } }); });
    res.status(204).send();
  } catch (error) { next(error); }
});
propertyRouter.post('/:id/discussion', async (req: AuthRequest, res, next) => {
  try {
    await expireDiscussionLocks();
    const propertyId = z.string().uuid().parse(req.params.id);
    const input = discussionSchema.parse(req.body);
    const employee = await currentEmployee(req.auth!.userId);
    if (!employee)
      throw new AppError(403, 'EMPLOYEE_PROFILE_REQUIRED', 'Only employee accounts can start a unit discussion');
    const existingCustomer = await prisma.lead.findFirst({
      where: { primaryPhone: input.customerPhone, deletedAt: null, assignedEmployeeId: { not: employee.id } },
      include: { assignedEmployee: true },
    });
    if (existingCustomer && !isManager(req.auth!.roles))
      throw new AppError(409, 'CUSTOMER_OWNED', 'This customer is already assigned to another executive', {
        assignedExecutive: existingCustomer.assignedEmployee?.fullName,
        leadStatus: existingCustomer.status,
      });
    const expiresAt = new Date(Date.now() + input.durationHours * 3_600_000);
    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.property.updateMany({
        where: { id: propertyId, deletedAt: null, status: 'AVAILABLE' },
        data: {
          status: 'IN_DISCUSSION',
          lockOwnerEmployeeId: employee.id,
          lockLeadId: input.leadId || null,
          lockCustomerName: input.customerName,
          lockCustomerPhone: input.customerPhone,
          lockStartedAt: new Date(),
          lockExpiresAt: expiresAt,
        },
      });
      if (updated.count !== 1) {
        const current = await tx.property.findFirst({ where: { id: propertyId }, include: { project: true } });
        throw new AppError(409, 'UNIT_LOCKED', `${current?.unitNumber ?? 'This unit'} is currently unavailable`, {
          status: current?.status,
          assignedEmployeeId: current?.lockOwnerEmployeeId,
          customerName: current?.lockCustomerName,
          expiresAt: current?.lockExpiresAt,
        });
      }
      const property = await tx.property.findUniqueOrThrow({ where: { id: propertyId }, include: { project: true } });
      await tx.unitLockHistory.create({
        data: {
          propertyId,
          action: 'DISCUSSION_STARTED',
          previousStatus: 'AVAILABLE',
          newStatus: 'IN_DISCUSSION',
          assignedEmployeeId: employee.id,
          leadId: input.leadId || null,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          expiresAt,
          actorUserId: req.auth!.userId,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: req.auth!.userId,
          action: 'LOCK_UNIT',
          entityType: 'PROPERTY',
          entityId: propertyId,
          newValues: { status: 'IN_DISCUSSION', customerName: input.customerName, expiresAt },
        },
      });
      return property;
    });
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});
propertyRouter.post('/:id/release', async (req: AuthRequest, res, next) => {
  try {
    const propertyId = z.string().uuid().parse(req.params.id);
    const input = reasonSchema.parse(req.body);
    const employee = await currentEmployee(req.auth!.userId);
    const unit = await prisma.property.findFirst({ where: { id: propertyId, deletedAt: null } });
    if (!unit) throw new AppError(404, 'UNIT_NOT_FOUND', 'Unit not found');
    if (!isManager(req.auth!.roles) && unit.lockOwnerEmployeeId !== employee?.id)
      throw new AppError(403, 'FORBIDDEN', 'Only the assigned executive or a manager can release this unit');
    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.property.update({
        where: { id: propertyId },
        data: {
          status: 'AVAILABLE',
          lockOwnerEmployeeId: null,
          lockLeadId: null,
          lockCustomerName: null,
          lockCustomerPhone: null,
          lockStartedAt: null,
          lockExpiresAt: null,
        },
        include: { project: true },
      });
      await tx.unitLockHistory.create({
        data: {
          propertyId,
          action: 'DISCUSSION_RELEASED',
          previousStatus: unit.status,
          newStatus: 'AVAILABLE',
          assignedEmployeeId: unit.lockOwnerEmployeeId,
          leadId: unit.lockLeadId,
          customerName: unit.lockCustomerName,
          customerPhone: unit.lockCustomerPhone,
          actorUserId: req.auth!.userId,
          reason: input.reason,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: req.auth!.userId,
          action: 'RELEASE_UNIT',
          entityType: 'PROPERTY',
          entityId: propertyId,
          oldValues: { status: unit.status },
          newValues: { status: 'AVAILABLE' },
        },
      });
      return updated;
    });
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});
propertyRouter.post('/:id/transfer', async (req: AuthRequest, res, next) => {
  try {
    if (!isManager(req.auth!.roles))
      throw new AppError(403, 'FORBIDDEN', 'Only managers can transfer a unit discussion');
    const propertyId = z.string().uuid().parse(req.params.id);
    const input = transferSchema.parse(req.body);
    const unit = await prisma.property.findFirst({
      where: { id: propertyId, status: 'IN_DISCUSSION', deletedAt: null },
    });
    if (!unit) throw new AppError(409, 'NO_ACTIVE_DISCUSSION', 'This unit has no active discussion to transfer');
    const recipient = await prisma.employee.findFirst({ where: { id: input.employeeId, deletedAt: null } });
    if (!recipient) throw new AppError(422, 'INVALID_EMPLOYEE', 'Select an active employee');
    const expiresAt = input.durationHours ? new Date(Date.now() + input.durationHours * 3_600_000) : unit.lockExpiresAt;
    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.property.update({
        where: { id: propertyId },
        data: { lockOwnerEmployeeId: recipient.id, lockExpiresAt: expiresAt },
        include: { project: true },
      });
      await tx.unitLockHistory.create({
        data: {
          propertyId,
          action: 'DISCUSSION_TRANSFERRED',
          previousStatus: 'IN_DISCUSSION',
          newStatus: 'IN_DISCUSSION',
          assignedEmployeeId: recipient.id,
          leadId: unit.lockLeadId,
          customerName: unit.lockCustomerName,
          customerPhone: unit.lockCustomerPhone,
          expiresAt,
          actorUserId: req.auth!.userId,
          reason: input.reason,
        },
      });
      return updated;
    });
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});
