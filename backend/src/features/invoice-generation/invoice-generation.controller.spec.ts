import { BadRequestException, ForbiddenException, HttpStatus, RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../auth/roles.guard';
import { InvoiceGenerationController } from './invoice-generation.controller';
import { InvoiceGenerationService, invoiceObjectKey } from './invoice-generation.service';

const BASE = '/api/invoices';

function makeService() {
  const prisma = {
    order: { findUnique: jest.fn() },
    invoice: { findUnique: jest.fn(), create: jest.fn() },
    vendorProfile: { findUnique: jest.fn() },
    customer: { findUnique: jest.fn() },
  };
  const minio = {
    putObject: jest.fn().mockResolvedValue({ etag: 'e', bucket: 'b', key: 'k' }),
    getSignedUrl: jest.fn().mockImplementation(async (key: string) => `https://minio.local/b/${key}?sig=1`),
  };
  const service = new InvoiceGenerationService(prisma as any, minio as any);
  return { prisma, minio, service };
}

describe('InvoiceGenerationController routes', () => {
  it(`mounts under ${BASE}`, () => {
    expect('/' + Reflect.getMetadata(PATH_METADATA, InvoiceGenerationController)).toBe(BASE);
  });

  it('POST /api/invoices returns 201 and is vendor-only', () => {
    const h = (InvoiceGenerationController.prototype as any).postApiInvoices;
    expect(Reflect.getMetadata(PATH_METADATA, h)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, h)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, h)).toBe(201);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, h)).toBe(HttpStatus.CREATED);
    expect(Reflect.getMetadata(ROLES_KEY, h)).toEqual(['VENDOR']);
  });

  it('GET /api/invoices/:id/download returns 200 and allows customers', () => {
    const h = (InvoiceGenerationController.prototype as any).getApiInvoicesIdDownload;
    expect(Reflect.getMetadata(PATH_METADATA, h)).toBe(':id/download');
    expect(Reflect.getMetadata(METHOD_METADATA, h)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, h)).toBe(HttpStatus.OK);
    expect(Reflect.getMetadata(ROLES_KEY, h)).toContain('CUSTOMER');
  });
});

describe('InvoiceGenerationService', () => {
  it('creates an invoice for the vendor\'s confirmed order and stores it in MinIO', async () => {
    const { prisma, minio, service } = makeService();
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'confirmed', vendorId: 'vp1', customerId: 'c1' });
    prisma.vendorProfile.findUnique.mockResolvedValue({ id: 'vp1', userId: 'u1' });
    prisma.invoice.findUnique.mockResolvedValue(null);
    prisma.invoice.create.mockResolvedValue({ id: 'inv1', orderId: 'o1', amount: 99.5 });

    const res = await service.createInvoice('u1', { orderId: 'o1', amount: 99.5 });
    expect(res).toEqual({ id: 'inv1', orderId: 'o1', amount: 99.5 });
    expect(minio.putObject).toHaveBeenCalledWith(invoiceObjectKey('inv1'), expect.any(Buffer), expect.any(Number), 'text/plain');
  });

  it('rejects orders that are not confirmed', async () => {
    const { prisma, service } = makeService();
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'pending', vendorId: 'vp1', customerId: 'c1' });
    prisma.vendorProfile.findUnique.mockResolvedValue({ id: 'vp1', userId: 'u1' });
    await expect(service.createInvoice('u1', { orderId: 'o1', amount: 1 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects orders of another vendor', async () => {
    const { prisma, service } = makeService();
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'confirmed', vendorId: 'other', customerId: 'c1' });
    prisma.vendorProfile.findUnique.mockResolvedValue({ id: 'vp1', userId: 'u1' });
    await expect(service.createInvoice('u1', { orderId: 'o1', amount: 1 })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns a presigned downloadUrl to the order\'s customer', async () => {
    const { prisma, service } = makeService();
    prisma.invoice.findUnique.mockResolvedValue({ id: 'inv1', orderId: 'o1', amount: 5, order: { customerId: 'c1', vendorId: 'vp1' } });
    prisma.customer.findUnique.mockResolvedValue({ id: 'c1', userId: 'u2' });
    const res = await service.getDownload('u2', 'CUSTOMER', 'inv1');
    expect(res.id).toBe('inv1');
    expect(res.downloadUrl).toContain(invoiceObjectKey('inv1'));
  });

  it('forbids other customers from downloading', async () => {
    const { prisma, service } = makeService();
    prisma.invoice.findUnique.mockResolvedValue({ id: 'inv1', orderId: 'o1', amount: 5, order: { customerId: 'c1', vendorId: 'vp1' } });
    prisma.customer.findUnique.mockResolvedValue({ id: 'c2', userId: 'u3' });
    await expect(service.getDownload('u3', 'CUSTOMER', 'inv1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
