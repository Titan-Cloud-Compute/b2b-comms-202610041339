import 'reflect-metadata';
import { BadRequestException, ExecutionContext, ForbiddenException, RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../auth/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

function ctxFor(role: string, handler: (...args: unknown[]) => unknown): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => AuditLogController,
    switchToHttp: () => ({ getRequest: () => ({ session: { userId: 'u1', email: 'x@y.z', role } }) }),
  } as unknown as ExecutionContext;
}

describe('AuditLogController', () => {
  const t1 = new Date('2026-01-01T00:00:00Z');
  const t2 = new Date('2026-01-02T00:00:00Z');
  let prisma: { auditEntry: { findMany: jest.Mock; create: jest.Mock } };
  let controller: AuditLogController;

  beforeEach(() => {
    prisma = {
      auditEntry: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'a', action: 'login', userId: 'u1', createdAt: t1 },
          { id: 'b', action: 'logout', userId: 'u1', createdAt: t2 },
        ]),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'new-id', ...data, createdAt: t2 }),
        ),
      },
    };
    controller = new AuditLogController(new AuditLogService(prisma as unknown as PrismaService));
  });

  it("is mounted at '/api/admin/audit-log' for GET and POST", () => {
    const base = Reflect.getMetadata(PATH_METADATA, AuditLogController);
    expect('/' + base).toBe('/api/admin/audit-log');
    const proto = AuditLogController.prototype;
    expect(Reflect.getMetadata(METHOD_METADATA, proto.getApiAdminAuditLog)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(METHOD_METADATA, proto.postApiAdminAuditLog)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(PATH_METADATA, proto.getApiAdminAuditLog)).toBe('/');
  });

  it('GET returns entries oldest-first (200)', async () => {
    const rows = await controller.getApiAdminAuditLog();
    expect(prisma.auditEntry.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'asc' } });
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(rows[0]).toEqual({ id: 'a', action: 'login', userId: 'u1', createdAt: t1.toISOString() });
  });

  it('POST stores the entry and responds 201 with the created record', async () => {
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, AuditLogController.prototype.postApiAdminAuditLog)).toBe(201);
    const created = await controller.postApiAdminAuditLog({ action: 'order.created', userId: 'u2' });
    expect(prisma.auditEntry.create).toHaveBeenCalledWith({ data: { action: 'order.created', userId: 'u2' } });
    expect(created).toMatchObject({ id: 'new-id', action: 'order.created', createdAt: t2.toISOString() });
  });

  it('POST rejects a missing action with 400', async () => {
    await expect(controller.postApiAdminAuditLog({ userId: 'u2' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('non-admin roles get 403', () => {
    const guard = new RolesGuard(new Reflector());
    const handler = AuditLogController.prototype.getApiAdminAuditLog;
    let err: unknown;
    try { guard.canActivate(ctxFor('USER', handler)); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getStatus()).toBe(403);
    expect(guard.canActivate(ctxFor('ADMIN', handler))).toBe(true);
  });
});
