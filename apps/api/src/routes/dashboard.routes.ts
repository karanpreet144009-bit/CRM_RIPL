import { Router } from 'express';
import { overview, salesOverview, setMonthlySalesTarget } from '../controllers/dashboard.controller.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize, type AuthRequest } from '../middleware/auth.js';
export const dashboardRouter = Router();
dashboardRouter.get('/overview', authenticate, overview);
dashboardRouter.get('/sales', authenticate, salesOverview);
dashboardRouter.put('/sales-target', authenticate, authorize('ADMINISTRATOR'), setMonthlySalesTarget);
dashboardRouter.get('/my-tasks', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const employee = await prisma.employee.findFirst({ where: { userId: req.auth!.userId, deletedAt: null }, select: { id: true } });
    if (!employee) return res.json({ success: true, data: [] });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const data = await prisma.dailyTask.findMany({
      where: { employeeId: employee.id, status: { in: ['PENDING', 'IN_PROGRESS'] }, dueDate: { lte: today } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 20
    });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
