import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const reportRouter = Router();
reportRouter.use(authenticate, authorize('ADMINISTRATOR', 'MANAGER'));
reportRouter.get('/summary', async (_req, res, next) => {
  try {
    const [leads, properties, bookings, payments, employees, schedules] = await Promise.all([
      prisma.lead.findMany({ where: { deletedAt: null }, include: { assignedEmployee: { select: { fullName: true } } } }),
      prisma.property.findMany({ where: { deletedAt: null }, include: { project: true } }),
      prisma.booking.findMany({ where: { status: { not: 'CANCELLED' } }, include: { property: { include: { project: true } }, customer: true } }),
      prisma.payment.findMany({ include: { booking: { include: { property: { include: { project: true } } } } } }),
      prisma.employee.findMany({ where: { deletedAt: null } }),
      prisma.paymentSchedule.findMany({ where: { status: { notIn: ['CANCELLED', 'WAIVED'] } } }),
    ]);
    const group = <T>(items: T[], key: (item: T) => string) => Object.entries(items.reduce<Record<string, number>>((acc, item) => { const name = key(item) || 'Unassigned'; acc[name] = (acc[name] ?? 0) + 1; return acc; }, {})).map(([label, count]) => ({ label, count }));
    const salesAmount = bookings.reduce((sum, booking) => sum + Number(booking.totalPropertyAmount), 0);
    const collected = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const gst = schedules.reduce((sum, item) => sum + Number(item.amount) * Number(item.gstRate) / 100, 0);
    const employeesReport = employees.map(employee => { const assigned = leads.filter(lead => lead.assignedEmployeeId === employee.id); const sales = bookings.filter(booking => booking.leadId && assigned.some(lead => lead.id === booking.leadId)); return { label: employee.fullName, leads: assigned.length, bookings: sales.length, value: sales.reduce((sum, booking) => sum + Number(booking.totalPropertyAmount), 0) }; });
    const brokerLeads = leads.filter(lead => lead.source.toLowerCase().includes('broker'));
    res.json({ success: true, data: { leadReport: { total: leads.length, byStatus: group(leads, lead => lead.status), bySource: group(leads, lead => lead.source) }, salesReport: { bookings: bookings.length, salesAmount, collected, projectWise: Object.entries(bookings.reduce<Record<string, number>>((acc, booking) => { const project = booking.property.project.name; acc[project] = (acc[project] ?? 0) + Number(booking.totalPropertyAmount); return acc; }, {})).map(([label, value]) => ({ label, value })) }, inventoryReport: { total: properties.length, byStatus: group(properties, property => property.status), projectWise: group(properties, property => property.project.name) }, paymentReport: { collected, count: payments.length, byMethod: Object.entries(payments.reduce<Record<string, number>>((acc, payment) => { acc[payment.method] = (acc[payment.method] ?? 0) + Number(payment.amount); return acc; }, {})).map(([label, value]) => ({ label, value })) }, brokerReport: { leads: brokerLeads.length, converted: brokerLeads.filter(lead => bookings.some(booking => booking.leadId === lead.id)).length, bySource: group(brokerLeads, lead => lead.source) }, employeeReport: employeesReport, gstReport: { taxableScheduledAmount: schedules.reduce((sum, item) => sum + Number(item.amount), 0), gstAmount: gst, schedules: schedules.length } } });
  } catch (error) { next(error); }
});
