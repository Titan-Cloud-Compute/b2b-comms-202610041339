import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../auth/roles.guard';
import { SharedChannelController } from './shared-channel.controller';
import { SharedChannelService } from './shared-channel.service';

const handler = (name: string) => (SharedChannelController.prototype as any)[name];

function makeService() {
  const prisma = {
    vendorProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'vp-1', userId: 'vendor-user' }) },
    channel: {
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'ch-1', ...data })),
      findMany: jest.fn().mockResolvedValue([{ id: 'ch-1', name: 'Shared', vendorId: 'vp-1' }]),
      findUnique: jest.fn().mockResolvedValue({ id: 'ch-1', name: 'Shared', vendorId: 'vp-1' }),
    },
    message: {
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'msg-1', ...data })),
    },
  };
  const service = new SharedChannelService(prisma as any);
  return { service, prisma };
}

const vendorReq = { session: { userId: 'vendor-user', role: 'VENDOR', firmId: null } } as any;
const customerReq = { session: { userId: 'customer-user', role: 'CUSTOMER', firmId: null } } as any;

describe('SharedChannelController routes', () => {
  it('is mounted at api/channels', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SharedChannelController)).toBe('api/channels');
  });

  it('POST /api/channels is vendor-only', () => {
    const h = handler('postApiChannels');
    expect(Reflect.getMetadata(PATH_METADATA, h)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, h)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(ROLES_KEY, h)).toEqual(['VENDOR']);
  });

  it('POST /api/channels/:id/messages and GET /api/channels allow vendors and customers', () => {
    const post = handler('postApiChannelsIdMessages');
    expect(Reflect.getMetadata(PATH_METADATA, post)).toBe(':id/messages');
    expect(Reflect.getMetadata(METHOD_METADATA, post)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(ROLES_KEY, post)).toEqual(['VENDOR', 'CUSTOMER']);
    const get = handler('getApiChannels');
    expect(Reflect.getMetadata(METHOD_METADATA, get)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(ROLES_KEY, get)).toEqual(['VENDOR', 'CUSTOMER']);
  });
});

describe('SharedChannel flow', () => {
  it('vendor creates a channel that shows in vendor and customer lists', async () => {
    const { service, prisma } = makeService();
    const controller = new SharedChannelController(service);
    const created = await controller.postApiChannels(vendorReq, { name: 'Shared' });
    expect(created).toEqual({ id: 'ch-1', name: 'Shared' });
    expect(prisma.channel.create).toHaveBeenCalledWith({
      data: { name: 'Shared', vendorId: 'vp-1', vendorProfileId: 'vp-1' },
    });
    await expect(controller.getApiChannels(vendorReq)).resolves.toEqual([{ id: 'ch-1', name: 'Shared' }]);
    await expect(controller.getApiChannels(customerReq)).resolves.toEqual([{ id: 'ch-1', name: 'Shared' }]);
  });

  it('customer posts a message and gets the created Message record', async () => {
    const { service, prisma } = makeService();
    const controller = new SharedChannelController(service);
    const msg = await controller.postApiChannelsIdMessages(customerReq, 'ch-1', { body: 'Hello' });
    expect(msg).toEqual({ id: 'msg-1', body: 'Hello', channelId: 'ch-1' });
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: { body: 'Hello', channelId: 'ch-1', senderId: 'customer-user' },
    });
  });

  it('rejects an empty message body', async () => {
    const { service } = makeService();
    const controller = new SharedChannelController(service);
    await expect(controller.postApiChannelsIdMessages(customerReq, 'ch-1', { body: '' })).rejects.toBeDefined();
  });
});
