import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';

export const exportRouter = Router();
const resourceSchema = z.enum(['leads', 'customers', 'properties', 'bookings', 'payments']);
const managementRoles = ['SUPER_ADMIN', 'DIRECTOR', 'ADMIN', 'ADMINISTRATOR', 'SALES_MANAGER', 'CRM_EXECUTIVE'];

function csvValue(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
function csv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(csvValue).join(',')).join('\r\n');
}
function isoDate(value: Date | null | undefined) { return value ? value.toISOString().slice(0, 10) : ''; }
function canManage(roles: string[]) { return roles.some((role) => managementRoles.includes(role)); }

exportRouter.use(authenticate);
exportRouter.get('/:resource.csv', async (req: AuthRequest, res, next) => {
  try {
    const resource = resourceSchema.parse(req.params.resource);
    let document = '';
    if (resource === 'leads') {
      const employee = await prisma.employee.findUnique({ where: { userId: req.auth!.userId } });
      const records = await prisma.lead.findMany({
        where: { deletedAt: null, ...(canManage(req.auth!.roles) ? {} : { assignedEmployeeId: employee?.id ?? '__unassigned__' }) },
        include: { assignedEmployee: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' },
      });
      document = csv(['Lead ID', 'Customer', 'Phone', 'Email', 'Source', 'Priority', 'Status', 'Assigned employee', 'Next follow-up', 'Created'], records.map((lead) => [lead.referenceNumber, lead.customerName, lead.primaryPhone, lead.email, lead.source, lead.priority, lead.status, lead.assignedEmployee?.fullName, isoDate(lead.nextFollowUpAt), isoDate(lead.createdAt)]));
    }
    if (resource === 'customers') {
      const records = await prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } });
      document = csv(['Customer ID', 'Full name', 'Phone', 'Email', 'Created'], records.map((customer) => [customer.referenceNumber, customer.fullName, customer.primaryPhone, customer.email, isoDate(customer.createdAt)]));
    }
    if (resource === 'properties') {
      const records = await prisma.property.findMany({ where: { deletedAt: null }, include: { project: true }, orderBy: { createdAt: 'desc' } });
      document = csv(['Unit ID', 'Project', 'Location', 'Unit', 'Type', 'Base price', 'Final price', 'Status', 'Discussion customer', 'Lock expiry', 'Created'], records.map((property) => [property.referenceNumber, property.project.name, property.project.location, property.unitNumber, property.type, property.basePrice, property.finalPrice, property.status, property.lockCustomerName, property.lockExpiresAt?.toISOString(), isoDate(property.createdAt)]));
    }
    if (resource === 'bookings') {
      const records = await prisma.booking.findMany({ include: { customer: true, property: { include: { project: true } } }, orderBy: { createdAt: 'desc' } });
      document = csv(['Booking ID', 'Booking date', 'Customer', 'Project', 'Unit', 'Token amount', 'Total amount', 'Payment status', 'Booking status', 'Created'], records.map((booking) => [booking.referenceNumber, isoDate(booking.bookingDate), booking.customer.fullName, booking.property.project.name, booking.property.unitNumber, booking.bookingAmount, booking.totalPropertyAmount, booking.paymentStatus, booking.status, isoDate(booking.createdAt)]));
    }
    if (resource === 'payments') {
      const records = await prisma.payment.findMany({ include: { booking: { include: { customer: true, property: { include: { project: true } } } } }, orderBy: { paymentDate: 'desc' } });
      document = csv(['Receipt', 'Payment date', 'Booking ID', 'Customer', 'Project', 'Unit', 'Amount', 'Payment method', 'Created'], records.map((payment) => [payment.receiptNumber, isoDate(payment.paymentDate), payment.booking.referenceNumber, payment.booking.customer.fullName, payment.booking.property.project.name, payment.booking.property.unitNumber, payment.amount, payment.method, isoDate(payment.createdAt)]));
    }
    await prisma.auditLog.create({ data: { userId: req.auth!.userId, action: 'EXPORT_CSV', entityType: resource.toUpperCase(), newValues: { format: 'csv' } } });
    res.setHeader('Content-Disposition', `attachment; filename="rrpl-${resource}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.type('text/csv; charset=utf-8').send(`\ufeff${document}`);
  } catch (error) { next(error); }
});
