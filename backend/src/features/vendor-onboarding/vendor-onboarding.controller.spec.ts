import type { Request } from 'express';
import { VendorOnboardingController } from './vendor-onboarding.controller';
import { VendorOnboardingService } from './vendor-onboarding.service';

function makePrisma() {
  const profiles: any[] = [];
  const documents: any[] = [];
  let seq = 0;
  return {
    profiles,
    documents,
    vendorProfile: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = profiles.find((p) => p.userId === where.userId);
        if (existing) return Object.assign(existing, update);
        const row = { id: `vp-${++seq}`, ...create };
        profiles.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => profiles.find((p) => p.userId === where.userId) ?? null),
    },
    document: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `doc-${++seq}`, ...data };
        documents.push(row);
        return row;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        documents.filter((d) => d.vendorProfileId === where.vendorProfileId),
      ),
    },
  };
}

const req = (userId: string) => ({ session: { userId } }) as unknown as Request;

describe('VendorOnboardingController', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let controller: VendorOnboardingController;

  beforeEach(() => {
    prisma = makePrisma();
    controller = new VendorOnboardingController(new VendorOnboardingService(prisma as any));
  });

  it('stores the vendor profile and returns the created record', async () => {
    const res = await controller.postApiVendorProfile(req('u1'), {
      companyName: 'Acme',
      contactEmail: 'vendor@acme.example.com',
    });
    expect(res).toEqual({ id: expect.any(String), companyName: 'Acme', contactEmail: 'vendor@acme.example.com' });
    expect(prisma.profiles).toHaveLength(1);
    expect(prisma.profiles[0].userId).toBe('u1');
  });

  it('rejects a profile without companyName', async () => {
    await expect(
      controller.postApiVendorProfile(req('u1'), { companyName: '', contactEmail: 'a@b.c' }),
    ).rejects.toThrow();
  });

  it('stores uploaded documents as pending and lists them in the library', async () => {
    await controller.postApiVendorProfile(req('u1'), { companyName: 'Acme', contactEmail: 'a@b.c' });
    const doc = await controller.postApiVendorDocuments(req('u1'), { filename: 'w9.pdf' });
    expect(doc).toEqual({ id: expect.any(String), filename: 'w9.pdf', status: 'pending' });
    const list = await controller.getApiVendorDocuments(req('u1'));
    expect(list).toEqual([{ id: doc.id, filename: 'w9.pdf', status: 'pending' }]);
  });

  it('refuses document upload before a profile exists', async () => {
    await expect(controller.postApiVendorDocuments(req('u2'), { filename: 'x.pdf' })).rejects.toThrow();
    expect(await controller.getApiVendorDocuments(req('u2'))).toEqual([]);
  });
});
