import { Router } from 'express';
import { overview, salesOverview, setMonthlySalesTarget } from '../controllers/dashboard.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
export const dashboardRouter = Router();
dashboardRouter.get('/overview', authenticate, overview);
dashboardRouter.get('/sales', authenticate, salesOverview);
dashboardRouter.put('/sales-target', authenticate, authorize('ADMINISTRATOR'), setMonthlySalesTarget);
