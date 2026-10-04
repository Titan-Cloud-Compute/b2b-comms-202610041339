import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../../lib/integrations/minio.service';
import type {
  GetApiInvoicesIdDownloadResponseDto,
  PostApiInvoicesRequestDto,
  PostApiInvoicesResponseDto,
} from './invoice-generation.dto';

/** Object-storage key for an invoice's stored document. */
export const invoiceObjectKey = (invoiceId: string): string => `invoices/${invoiceId}.txt`;

@Injectable()
export class InvoiceGenerationService extends FeatureService {
  constructor(
    prisma: PrismaService,
    private readonly minio: MinioService,
  ) {
    super(prisma, ['Invoice', 'Order', 'VendorProfile', 'Customer'] as const);
  }

  /** Vendor generates an invoice for one of their confirmed orders; stores the document in MinIO. */
  async createInvoice(userId: string, body: PostApiInvoicesRequestDto): Promise<PostApiInvoicesResponseDto> {
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    const amount = Number(body?.amount);
    if (!orderId) throw new BadRequestException('orderId is required');
    if (!Number.isFinite(amount) || amount < 0) throw new BadRequestException('amount must be a non-negative number');

    const order = await this.model('Order').findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const vendor = await this.model('VendorProfile').findUnique({ where: { userId } });
    const ownsOrder = order.vendorId === userId || (!!vendor && order.vendorId === vendor.id);
    if (!ownsOrder) throw new ForbiddenException('Order does not belong to this vendor');
    if (String(order.status).toLowerCase() !== 'confirmed') {
      throw new BadRequestException('Invoices can only be generated for confirmed orders');
    }

    const existing = await this.model('Invoice').findUnique({ where: { orderId } });
    if (existing) throw new ConflictException('An invoice already exists for this order');

    const invoice = await this.model('Invoice').create({ data: { orderId, amount } });
    const doc = Buffer.from(
      `INVOICE ${invoice.id}\nOrder: ${orderId}\nAmount: ${amount.toFixed(2)}\nIssued: ${new Date().toISOString()}\n`,
      'utf8',
    );
    await this.minio.putObject(invoiceObjectKey(invoice.id), doc, doc.length, 'text/plain');
    return { id: invoice.id, orderId: invoice.orderId, amount: invoice.amount };
  }

  /** Customer (or owning vendor) gets a presigned download URL for the stored invoice. */
  async getDownload(userId: string, role: UserRole, id: string): Promise<GetApiInvoicesIdDownloadResponseDto> {
    const invoice = await this.model('Invoice').findUnique({ where: { id }, include: { order: true } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    let allowed = false;
    if (role === 'CUSTOMER') {
      const customer = await this.model('Customer').findUnique({ where: { userId } });
      allowed = !!customer && invoice.order.customerId === customer.id;
    } else if (role === 'VENDOR') {
      const vendor = await this.model('VendorProfile').findUnique({ where: { userId } });
      allowed = invoice.order.vendorId === userId || (!!vendor && invoice.order.vendorId === vendor.id);
    }
    if (!allowed) throw new ForbiddenException('Not allowed to download this invoice');

    const downloadUrl = await this.minio.getSignedUrl(invoiceObjectKey(invoice.id));
    return { id: invoice.id, downloadUrl };
  }
}
