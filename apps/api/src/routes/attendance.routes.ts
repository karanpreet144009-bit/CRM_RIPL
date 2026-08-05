import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

export const attendanceRouter = Router();
const notesSchema = z.object({ notes: z.string().trim().max(500).optional().or(z.literal('')) });
const today = () => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); };
const requireAttendanceEmployee = (req: AuthRequest) => { if (req.auth?.roles.some((role) => role === 'ADMINISTRATOR' || role === 'ADMIN')) throw new AppError(403, 'ATTENDANCE_EMPLOYEES_ONLY', 'Attendance marking is available to employees only'); };
async function notifyAdministratorsOfAttendance(employeeName: string, attendanceId: string, action: 'CHECK_IN' | 'CHECK_OUT', occurredAt: Date) {
  const administrators = await prisma.user.findMany({ where: { userRoles: { some: { role: { code: { in: ['ADMINISTRATOR', 'ADMIN'] } } } } }, select: { id: true } });
  const actionLabel = action === 'CHECK_IN' ? 'checked in' : 'checked out';
  await Promise.all(administrators.map((administrator) => prisma.notification.upsert({
    where: { dedupeKey: `attendance-${action.toLowerCase()}-${attendanceId}-${administrator.id}` }, update: {},
    create: { dedupeKey: `attendance-${action.toLowerCase()}-${attendanceId}-${administrator.id}`, userId: administrator.id, type: 'ATTENDANCE_UPDATE', title: `Employee ${action === 'CHECK_IN' ? 'check-in' : 'check-out'}`, message: `${employeeName} ${actionLabel} at ${occurredAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.`, link: '/attendance' },
  })));
}

attendanceRouter.use(authenticate);

attendanceRouter.get('/me/today', async (req: AuthRequest, res, next) => {
  try {
    requireAttendanceEmployee(req);
    const employee = await prisma.employee.findFirst({ where: { userId: req.auth!.userId, deletedAt: null } });
    if (!employee) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee profile not found');
    const data = await prisma.attendance.findUnique({ where: { employeeId_workDate: { employeeId: employee.id, workDate: today() } } });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

attendanceRouter.post('/me/check-in', async (req: AuthRequest, res, next) => {
  try {
    requireAttendanceEmployee(req);
    const input = notesSchema.parse(req.body); const employee = await prisma.employee.findFirst({ where: { userId: req.auth!.userId, deletedAt: null } });
    if (!employee) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee profile not found');
    const workDate = today(); const existing = await prisma.attendance.findUnique({ where: { employeeId_workDate: { employeeId: employee.id, workDate } } });
    if (existing) throw new AppError(409, 'ALREADY_CHECKED_IN', 'Attendance is already marked for today');
    const data = await prisma.attendance.create({ data: { employeeId: employee.id, workDate, checkInAt: new Date(), notes: input.notes || null } });
    await prisma.auditLog.create({ data: { userId: req.auth!.userId, action: 'CHECK_IN', entityType: 'ATTENDANCE', entityId: data.id, newValues: { workDate } } });
    await notifyAdministratorsOfAttendance(employee.fullName, data.id, 'CHECK_IN', data.checkInAt);
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
});

attendanceRouter.post('/me/check-out', async (req: AuthRequest, res, next) => {
  try {
    requireAttendanceEmployee(req);
    const input = notesSchema.parse(req.body); const employee = await prisma.employee.findFirst({ where: { userId: req.auth!.userId, deletedAt: null } });
    if (!employee) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee profile not found');
    const current = await prisma.attendance.findUnique({ where: { employeeId_workDate: { employeeId: employee.id, workDate: today() } } });
    if (!current) throw new AppError(400, 'CHECK_IN_REQUIRED', 'Check in before checking out'); if (current.checkOutAt) throw new AppError(409, 'ALREADY_CHECKED_OUT', 'You have already checked out today');
    const data = await prisma.attendance.update({ where: { id: current.id }, data: { checkOutAt: new Date(), ...(input.notes ? { notes: input.notes } : {}) } });
    await prisma.auditLog.create({ data: { userId: req.auth!.userId, action: 'CHECK_OUT', entityType: 'ATTENDANCE', entityId: data.id, newValues: { workDate: current.workDate } } });
    await notifyAdministratorsOfAttendance(employee.fullName, data.id, 'CHECK_OUT', data.checkOutAt!);
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

attendanceRouter.get('/', authorize('ADMINISTRATOR'), async (req, res, next) => {
  try {
    const day = z.coerce.date().optional().parse(req.query.date) ?? today();
    const data = await prisma.attendance.findMany({ where: { workDate: day }, include: { employee: true }, orderBy: { checkInAt: 'asc' } });
    res.json({ success: true, data: data.map(item => ({ ...item, employee: { id: item.employee.id, fullName: item.employee.fullName, employeeCode: item.employee.employeeCode, department: item.employee.department } })) });
  } catch (error) { next(error); }
});
