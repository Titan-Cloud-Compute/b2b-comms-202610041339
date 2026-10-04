import { UserRole } from '@prisma/client';
import { OrderManagementController } from './order-management.controller';
import { OrderManagementService } from './order-management.service';

function makePrisma() {
  return {
    customer: { findUnique: jest.fn().mockResolvedValue({ id: 'cust-1', userId: 'u-1' }) },
    vendorProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'vend-1', userId: 'u-2' }) },
    order: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'ord-1', status: data.status, customerId: data.customerId, vendorId: data.vendorId }),
      ),
      findUnique: jest.fn().mockResolvedValue({ id: 'ord-1', status: 'pending', customerId: 'cust-1', vendorId: 'vend-1' }),
      update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, status: data.status })),
      findMany: jest.fn().mockResolvedValue([{ id: 'ord-1', status: 'pending' }]),
    },
  };
}

describe('OrderManagementController', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let controller: OrderManagementController;

  beforeEach(() => {
    prisma = makePrisma();
    controller = new OrderManagementController(new OrderManagementService(prisma as never));
  });

  it('creates a pending order with items for the session customer', async () => {
    const req = { session: { userId: 'u-1', role: UserRole.CUSTOMER } } as never;
    const res = await controller.postApiOrders(req, {
      vendorId: 'vend-1',
      items: [{ description: 'Widget', quantity: 2, unitPrice: 9.5 }],
    } as never);
    expect(res).toEqual({ id: 'ord-1', status: 'pending', customerId: 'cust-1' });
    expect(prisma.order.create.mock.calls[0][0].data.orderItems.create).toHaveLength(1);
  });

  it('confirms an order for the owning vendor', async () => {
    const req = { session: { userId: 'u-2', role: UserRole.VENDOR } } as never;
    const res = await controller.patchApiOrdersIdConfirm(req, 'ord-1', { estimatedDelivery: '2026-10-10' });
    expect(res).toEqual({ id: 'ord-1', status: 'confirmed' });
  });

  it('rejects an invalid delivery date', async () => {
    const req = { session: { userId: 'u-2', role: UserRole.VENDOR } } as never;
    await expect(controller.patchApiOrdersIdConfirm(req, 'ord-1', { estimatedDelivery: 'nope' })).rejects.toThrow();
  });

  it('lists orders scoped to the customer', async () => {
    const req = { session: { userId: 'u-1', role: UserRole.CUSTOMER } } as never;
    const res = await controller.getApiOrders(req);
    expect(res).toEqual([{ id: 'ord-1', status: 'pending' }]);
    expect(prisma.order.findMany.mock.calls[0][0].where).toEqual({ customerId: 'cust-1' });
  });
});
