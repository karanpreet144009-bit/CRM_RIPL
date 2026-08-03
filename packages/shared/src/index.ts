import { z } from 'zod';

export const roles = ['ADMINISTRATOR', 'MANAGER', 'SALES_EXECUTIVE', 'RECEPTION'] as const;
export type RoleCode = (typeof roles)[number];
export const passwordSchema = z.string().min(12).max(128).regex(/[A-Z]/, 'Include an uppercase letter').regex(/[a-z]/, 'Include a lowercase letter').regex(/[0-9]/, 'Include a number').regex(/[^A-Za-z0-9]/, 'Include a symbol');
export const paginationSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), search: z.string().trim().max(100).optional(), sortBy: z.string().max(64).optional(), sortOrder: z.enum(['asc', 'desc']).default('desc') });
export type ApiResponse<T> = { success: true; data: T; meta?: Record<string, unknown> };
