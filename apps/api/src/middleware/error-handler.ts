import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const safeError = error instanceof Error ? { name: error.name, message: error.message } : { name: 'UnknownError' };
  console.error('API request failed', safeError);
  if (error instanceof ZodError) return void res.status(422).json({ success:false, error:{ code:'VALIDATION_ERROR', message:'Validation failed', details:error.flatten() } });
  const appError = error instanceof AppError ? error : new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  res.status(appError.statusCode).json({ success:false, error:{ code:appError.code, message:appError.message, ...(appError.details ? {details:appError.details} : {}) } });
};
