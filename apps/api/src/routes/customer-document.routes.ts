import { Router } from 'express';
import multer from 'multer';
import { mkdir, unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

export const customerDocumentRouter = Router();
const uploadDirectory = path.resolve(process.cwd(), 'uploads', 'customer-documents');
const defaultBrochurePath = path.resolve(process.cwd(), 'uploads', 'brochures', 'rrpl-housing-group-sample-brochure.pdf');
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const allowedDocumentTypes = z.enum(['PAN', 'AADHAAR', 'AGREEMENT', 'RECEIPT', 'BROCHURE', 'OTHER']);
const extension = (mimeType: string) => ({ 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[mimeType] ?? '');
const storage = multer.diskStorage({
  destination: async (_req, _file, callback) => { try { await mkdir(uploadDirectory, { recursive: true }); callback(null, uploadDirectory); } catch (error) { callback(error as Error, uploadDirectory); } },
  filename: (_req, file, callback) => callback(null, `${randomUUID()}${extension(file.mimetype)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, callback) => callback(null, allowedTypes.has(file.mimetype)) });

customerDocumentRouter.get('/default-brochure', async (_req, res, next) => {
  try {
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'inline; filename="rrpl-housing-group-brochure.pdf"');
    createReadStream(defaultBrochurePath).on('error', () => next(new AppError(404, 'BROCHURE_NOT_FOUND', 'Default brochure is unavailable'))).pipe(res);
  } catch (error) { next(error); }
});
customerDocumentRouter.get('/shared/:token', async (req, res, next) => {
  try {
    const token = z.string().uuid().parse(req.params.token);
    const share = await prisma.customerDocumentShare.findFirst({ where: { token, revokedAt: null, expiresAt: { gt: new Date() } }, include: { document: true } });
    if (!share || share.document.deletedAt) throw new AppError(404, 'SHARE_NOT_FOUND', 'This brochure link has expired or is unavailable');
    if (!path.resolve(share.document.storagePath).startsWith(uploadDirectory + path.sep)) throw new AppError(400, 'INVALID_DOCUMENT_PATH', 'Document storage path is invalid');
    res.setHeader('Content-Type', share.document.mimeType); res.setHeader('Content-Disposition', `inline; filename="${share.document.originalName.replaceAll('"', '')}"`);
    createReadStream(share.document.storagePath).on('error', next).pipe(res);
  } catch (error) { next(error); }
});

customerDocumentRouter.use(authenticate);
customerDocumentRouter.get('/', async (req, res, next) => {
  try {
    const customerId = z.string().uuid().parse(req.query.customerId);
    const data = await prisma.customerDocument.findMany({ where: { customerId, deletedAt: null }, orderBy: { createdAt: 'desc' }, select: { id: true, type: true, originalName: true, mimeType: true, fileSize: true, createdAt: true } });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
customerDocumentRouter.post('/:customerId', upload.single('file'), async (req: AuthRequest, res, next) => {
  let storedFile: Express.Multer.File | undefined;
  try {
    storedFile = req.file;
    const customerId = z.string().uuid().parse(req.params.customerId);
    const type = allowedDocumentTypes.parse(req.body.type);
    if (!storedFile) throw new AppError(422, 'FILE_REQUIRED', 'Select a document to upload');
    const customer = await prisma.customer.findFirst({ where: { id: customerId, deletedAt: null } });
    if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
    const data = await prisma.$transaction(async (tx) => {
      const document = await tx.customerDocument.create({ data: { customerId, type, originalName: path.basename(storedFile!.originalname).slice(0, 180), storagePath: storedFile!.path, mimeType: storedFile!.mimetype, fileSize: storedFile!.size, uploadedById: req.auth!.userId } });
      await tx.auditLog.create({ data: { userId: req.auth!.userId, action: 'UPLOAD_DOCUMENT', entityType: 'CUSTOMER_DOCUMENT', entityId: document.id, newValues: { customerId, type, originalName: document.originalName } } });
      return document;
    });
    res.status(201).json({ success: true, data: { id: data.id, type: data.type, originalName: data.originalName, fileSize: data.fileSize, createdAt: data.createdAt } });
  } catch (error) {
    if (storedFile) await unlink(storedFile.path).catch(() => undefined);
    next(error);
  }
});
customerDocumentRouter.get('/:documentId/download', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.documentId);
    const document = await prisma.customerDocument.findFirst({ where: { id, deletedAt: null } });
    if (!document) throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
    if (!path.resolve(document.storagePath).startsWith(uploadDirectory + path.sep)) throw new AppError(400, 'INVALID_DOCUMENT_PATH', 'Document storage path is invalid');
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName.replaceAll('"', '')}"`);
    createReadStream(document.storagePath).on('error', next).pipe(res);
  } catch (error) { next(error); }
});
customerDocumentRouter.post('/:documentId/share', async (req: AuthRequest, res, next) => {
  try {
    const documentId = z.string().uuid().parse(req.params.documentId);
    const document = await prisma.customerDocument.findFirst({ where: { id: documentId, deletedAt: null } });
    if (!document) throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
    const share = await prisma.customerDocumentShare.create({ data: { documentId, token: randomUUID(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), createdById: req.auth!.userId } });
    await prisma.auditLog.create({ data: { userId: req.auth!.userId, action: 'CREATE_DOCUMENT_SHARE', entityType: 'CUSTOMER_DOCUMENT', entityId: documentId, newValues: { expiresAt: share.expiresAt } } });
    const shareUrl = `${req.protocol}://${req.get('host')}/api/v1/customer-documents/shared/${share.token}`;
    res.status(201).json({ success: true, data: { shareUrl, expiresAt: share.expiresAt } });
  } catch (error) { next(error); }
});
customerDocumentRouter.delete('/:documentId', async (req: AuthRequest, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.documentId);
    const document = await prisma.customerDocument.findFirst({ where: { id, deletedAt: null } });
    if (!document) throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
    await prisma.$transaction(async (tx) => { await tx.customerDocument.update({ where: { id }, data: { deletedAt: new Date() } }); await tx.auditLog.create({ data: { userId: req.auth!.userId, action: 'DELETE_DOCUMENT', entityType: 'CUSTOMER_DOCUMENT', entityId: id } }); });
    await unlink(document.storagePath).catch(() => undefined);
    res.status(204).send();
  } catch (error) { next(error); }
});
