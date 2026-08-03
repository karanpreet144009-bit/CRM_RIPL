import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

export const importRouter = Router();
const resourceSchema = z.enum(['leads', 'customers', 'properties', 'bookings', 'payments']);
const bodySchema = z.object({ csv: z.string().min(2).max(1_000_000) });
const leadStatuses = new Set(['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT_SCHEDULED', 'SITE_VISITED', 'NEGOTIATION', 'BOOKING_IN_PROGRESS', 'BOOKED', 'LOST', 'FUTURE_PROSPECT']);
const priorities = new Set(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
const propertyTypes = new Set(['FLAT', 'SHOP', 'OFFICE']);
const propertyStatuses = new Set(['AVAILABLE', 'IN_DISCUSSION', 'SITE_VISIT_SCHEDULED', 'HOLD', 'RESERVED', 'BOOKING_IN_PROGRESS', 'BOOKED', 'SOLD', 'BLOCKED', 'CANCELLED']);
const bookingStatuses = new Set(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CONFIRMED', 'CANCELLED']);
const paymentStatuses = new Set(['PENDING', 'PARTIALLY_PAID', 'PAID', 'REFUND_PENDING', 'REFUNDED']);
const paymentMethods = new Set(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER']);

type Row = Record<string, string>;
function parseCsv(input: string): Row[] {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (!quoted && character === ',') { row.push(cell.trim()); cell = ''; continue; }
    if (!quoted && character === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = ''; continue; }
    cell += character;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  const [headers, ...values] = rows.filter((items) => items.some(Boolean));
  if (!headers?.length) throw new AppError(422, 'INVALID_CSV', 'The CSV file is empty');
  if (values.length > 1_000) throw new AppError(422, 'CSV_TOO_LARGE', 'A maximum of 1,000 rows can be imported at once');
  return values.map((items) => Object.fromEntries(headers.map((header, index) => [header.trim(), items[index]?.trim() ?? ''])));
}
function money(value: string) { const amount = Number(value.replace(/[₹,\s]/g, '')); return Number.isFinite(amount) && amount > 0 ? amount : null; }
function date(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed; }
function projectCode(name: string) { return `IMP-${name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'PROJECT'}`; }

importRouter.use(authenticate, authorize('ADMINISTRATOR'));
importRouter.post('/:resource', async (req: AuthRequest, res, next) => {
  try {
    const resource = resourceSchema.parse(req.params.resource);
    const rows = parseCsv(bodySchema.parse(req.body).csv);
    let imported = 0; let skipped = 0; const errors: string[] = [];
    const skip = (row: number, message: string) => { skipped += 1; if (errors.length < 20) errors.push(`Row ${row}: ${message}`); };
    const employee = await prisma.employee.findUnique({ where: { userId: req.auth!.userId } });

    for (const [offset, row] of rows.entries()) {
      const rowNumber = offset + 2;
      try {
        if (resource === 'customers') {
          const fullName = row['Full name']; const primaryPhone = row.Phone;
          if (!fullName || !primaryPhone) { skip(rowNumber, 'Full name and Phone are required'); continue; }
          if (await prisma.customer.findFirst({ where: { primaryPhone, deletedAt: null } })) { skip(rowNumber, 'Customer phone already exists'); continue; }
          await prisma.customer.create({ data: { referenceNumber: row['Customer ID'] || `CUS-IMP-${Date.now()}-${offset}`, fullName, primaryPhone, email: row.Email || null } }); imported += 1; continue;
        }
        if (resource === 'leads') {
          const customerName = row.Customer; const primaryPhone = row.Phone;
          if (!customerName || !primaryPhone) { skip(rowNumber, 'Customer and Phone are required'); continue; }
          if (await prisma.lead.findFirst({ where: { primaryPhone, deletedAt: null } })) { skip(rowNumber, 'Lead phone already exists'); continue; }
          const status = leadStatuses.has(row.Status) ? row.Status : 'NEW'; const priority = priorities.has(row.Priority) ? row.Priority : 'MEDIUM';
          await prisma.lead.create({ data: { referenceNumber: row['Lead ID'] || `LEAD-IMP-${Date.now()}-${offset}`, customerName, primaryPhone, email: row.Email || null, source: row.Source || 'CSV Import', status: status as never, priority: priority as never, assignedEmployeeId: employee?.id } }); imported += 1; continue;
        }
        if (resource === 'properties') {
          const projectName = row.Project; const unitNumber = row.Unit; const type = row.Type; const basePrice = money(row['Base price']); const finalPrice = money(row['Final price']);
          if (!projectName || !unitNumber || !propertyTypes.has(type) || !basePrice || !finalPrice) { skip(rowNumber, 'Project, Unit, valid Type, Base price and Final price are required'); continue; }
          let project = await prisma.project.findFirst({ where: { name: projectName, deletedAt: null } });
          if (!project) { project = await prisma.project.create({ data: { code: `${projectCode(projectName)}-${Date.now()}-${offset}`, name: projectName, location: row.Location || 'Not specified', status: 'ACTIVE' } }); }
          if (await prisma.property.findFirst({ where: { projectId: project.id, unitNumber, deletedAt: null } })) { skip(rowNumber, 'Unit already exists in this project'); continue; }
          const status = propertyStatuses.has(row.Status) ? row.Status : 'AVAILABLE';
          await prisma.property.create({ data: { referenceNumber: row['Unit ID'] || `UNIT-IMP-${Date.now()}-${offset}`, projectId: project.id, unitNumber, type: type as never, basePrice, finalPrice, status: status as never } }); imported += 1; continue;
        }
        if (resource === 'bookings') {
          const referenceNumber = row['Booking ID']; const bookingAmount = money(row['Token amount']); const totalPropertyAmount = money(row['Total amount']);
          const bookingDate = date(row['Booking date']);
          if (!referenceNumber || !row.Customer || !row.Project || !row.Unit || !bookingAmount || !totalPropertyAmount || !bookingDate) { skip(rowNumber, 'Booking ID, date, customer, project, unit and amounts are required'); continue; }
          if (await prisma.booking.findUnique({ where: { referenceNumber } })) { skip(rowNumber, 'Booking ID already exists'); continue; }
          const customer = await prisma.customer.findFirst({ where: { fullName: row.Customer, deletedAt: null } }); const property = await prisma.property.findFirst({ where: { unitNumber: row.Unit, project: { name: row.Project }, deletedAt: null } });
          if (!customer || !property) { skip(rowNumber, 'Customer or property was not found; import those first'); continue; }
          await prisma.booking.create({ data: { referenceNumber, customerId: customer.id, propertyId: property.id, bookingDate, bookingAmount, totalPropertyAmount, status: (bookingStatuses.has(row['Booking status']) ? row['Booking status'] : 'PENDING_APPROVAL') as never, paymentStatus: (paymentStatuses.has(row['Payment status']) ? row['Payment status'] : 'PENDING') as never } }); imported += 1; continue;
        }
        const receiptNumber = row.Receipt; const amount = money(row.Amount); const paymentDate = date(row['Payment date']);
        if (!receiptNumber || !row['Booking ID'] || !amount || !paymentDate) { skip(rowNumber, 'Receipt, payment date, booking ID and amount are required'); continue; }
        if (await prisma.payment.findUnique({ where: { receiptNumber } })) { skip(rowNumber, 'Receipt already exists'); continue; }
        const booking = await prisma.booking.findUnique({ where: { referenceNumber: row['Booking ID'] } });
        if (!booking) { skip(rowNumber, 'Booking was not found; import bookings first'); continue; }
        await prisma.payment.create({ data: { receiptNumber, bookingId: booking.id, amount, paymentDate, method: (paymentMethods.has(row['Payment method']) ? row['Payment method'] : 'OTHER') as never } }); imported += 1;
      } catch { skip(rowNumber, 'Could not import this row'); }
    }
    await prisma.auditLog.create({ data: { userId: req.auth!.userId, action: 'IMPORT_CSV', entityType: resource.toUpperCase(), newValues: { imported, skipped } } });
    res.status(201).json({ success: true, data: { imported, skipped, errors } });
  } catch (error) { next(error); }
});
