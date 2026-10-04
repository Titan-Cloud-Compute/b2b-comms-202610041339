import { ConflictException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { CustomerInviteController } from './customer-invite.controller';
import { CustomerInviteService } from './customer-invite.service';
import { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  const users: Array<{ id: string; email: string; role: string }> = [];
  const customers: Array<{ id: string; email: string; userId: string }> = [];
  let seq = 0;
  return {
    user: {
      findUnique: jest.fn(async ({ where }: any) => users.find((u) => u.email === where.email) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const u = { id: `u${++seq}`, ...data };
        users.push(u);
        return u;
      }),
    },
    customer: {
      findUnique: jest.fn(async ({ where }: any) =>
        customers.find((c) => (where.email ? c.email === where.email : c.userId === where.userId)) ?? null,
      ),
      create: jest.fn(async ({ data }: any) => {
        const c = { id: `c${++seq}`, ...data };
        customers.push(c);
        return c;
      }),
      findMany: jest.fn(async () => customers.map((c) => ({ id: c.id, email: c.email }))),
    },
  };
}

describe('CustomerInviteController', () => {
  let controller: CustomerInviteController;

  beforeEach(() => {
    const service = new CustomerInviteService(makePrisma() as unknown as PrismaService);
    controller = new CustomerInviteController(service);
  });

  it('is mounted at the contract path', () => {
    expect(Reflect.getMetadata(PATH_METADATA, CustomerInviteController)).toBe('api/admin/customers');
  });

  it('invites a customer and returns invitationSent true', async () => {
    const res = await controller.postApiAdminCustomersInvite({ email: 'Buyer@Corp.example.com' });
    expect(res).toEqual({ customerId: expect.any(String), email: 'buyer@corp.example.com', invitationSent: true });
    const list = await controller.getApiAdminCustomers();
    expect(list).toEqual([{ id: res.customerId, email: 'buyer@corp.example.com' }]);
  });

  it('rejects a duplicate invite with 409', async () => {
    await controller.postApiAdminCustomersInvite({ email: 'dup@corp.example.com' });
    await expect(controller.postApiAdminCustomersInvite({ email: 'dup@corp.example.com' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
