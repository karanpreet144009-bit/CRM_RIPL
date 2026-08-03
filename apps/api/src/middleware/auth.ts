import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/tokens.js';
import { AppError } from '../utils/errors.js';
export interface AuthRequest extends Request { auth?: { userId: string; roles: string[] } }
export async function authenticate(req: AuthRequest, _res: Response, next: NextFunction) { try { const token = req.headers.authorization?.replace(/^Bearer\s+/i, ''); if (!token) throw new AppError(401,'UNAUTHENTICATED','Authentication required'); const payload=await verifyAccessToken(token); req.auth = { userId:payload.sub, roles:payload.roles }; next(); } catch { next(new AppError(401,'UNAUTHENTICATED','Invalid or expired access token')); } }
export function authorize(...allowedRoles: string[]) { return (req: AuthRequest, _res: Response, next: NextFunction) => !req.auth || !req.auth.roles.some(role => allowedRoles.includes(role)) ? next(new AppError(403,'FORBIDDEN','Insufficient permission')) : next(); }
