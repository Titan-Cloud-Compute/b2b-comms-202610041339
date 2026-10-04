import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  GetApiOrdersResponseDto,
  PatchApiOrdersIdConfirmRequestDto,
  PatchApiOrdersIdConfirmResponseDto,
  PostApiOrdersRequestDto,
  PostApiOrdersResponseDto,
} from './order-management.dto';

export interface OrderItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

@Injectable()
export class OrderManagementService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['Order', 'OrderItem'] as const);
  }

  async create(
    userId: string,
    body: PostApiOrdersRequestDto & { items?: OrderItemInput[] },
  ): Promise<PostApiOrdersResponseDto> {
    if (!body?.vendorId) throw new BadRequestException('vendorId is required');
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new ForbiddenException('No customer record for this user');
    const items = (body.items ?? []).filter((i) => i && i.description);
    const order = await this.model('Order').create({
      data: {
        status: 'pending',
        customerId: customer.id,
        vendorId: body.vendorId,
        orderItems: {
          create: items.map((i) => ({
            description: String(i.description),
            quantity: Math.trunc(Number(i.quantity) || 0),
            unitPrice: Number(i.unitPrice) || 0,
          })),
        },
      },
    });
    return { id: order.id, status: order.status, customerId: order.customerId };
  }

  async confirm(
    userId: string,
    id: string,
    body: PatchApiOrdersIdConfirmRequestDto,
  ): Promise<PatchApiOrdersIdConfirmResponseDto> {
    if (!body?.estimatedDelivery || Number.isNaN(Date.parse(body.estimatedDelivery))) {
      throw new BadRequestException('estimatedDelivery must be a valid date');
    }
    const vendor = await this.prisma.vendorProfile.findUnique({ where: { userId } });
    const order = await this.model('Order').findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (!vendor || order.vendorId !== vendor.id) throw new ForbiddenException('Not your order');
    const updated = await this.model('Order').update({
      where: { id },
      data: { status: 'confirmed' },
    });
    return { id: updated.id, status: updated.status };
  }

  async list(userId: string, role: UserRole): Promise<GetApiOrdersResponseDto[]> {
    let where: { customerId?: string; vendorId?: string };
    if (role === UserRole.VENDOR) {
      const vendor = await this.prisma.vendorProfile.findUnique({ where: { userId } });
      if (!vendor) return [];
      where = { vendorId: vendor.id };
    } else {
      const customer = await this.prisma.customer.findUnique({ where: { userId } });
      if (!customer) return [];
      where = { customerId: customer.id };
    }
    const orders = await this.model('Order').findMany({ where, orderBy: { createdAt: 'desc' } });
    return orders.map((o) => ({ id: o.id, status: o.status }));
  }
}
