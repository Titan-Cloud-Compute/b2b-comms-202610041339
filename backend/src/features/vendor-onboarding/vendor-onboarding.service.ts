import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  GetApiVendorDocumentsResponseDto,
  PostApiVendorDocumentsRequestDto,
  PostApiVendorDocumentsResponseDto,
  PostApiVendorProfileRequestDto,
  PostApiVendorProfileResponseDto,
} from './vendor-onboarding.dto';

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException(`${field} is required`);
  }
  return value.trim();
}

@Injectable()
export class VendorOnboardingService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['VendorProfile', 'Document'] as const);
  }

  async upsertProfile(
    userId: string,
    body: PostApiVendorProfileRequestDto,
  ): Promise<PostApiVendorProfileResponseDto> {
    const companyName = requireString(body?.companyName, 'companyName');
    const contactEmail = requireString(body?.contactEmail, 'contactEmail');
    const profile = await this.model('VendorProfile').upsert({
      where: { userId },
      create: { userId, companyName, contactEmail },
      update: { companyName, contactEmail },
    });
    return { id: profile.id, companyName: profile.companyName, contactEmail: profile.contactEmail };
  }

  async createDocument(
    userId: string,
    body: PostApiVendorDocumentsRequestDto,
  ): Promise<PostApiVendorDocumentsResponseDto> {
    const filename = requireString(body?.filename, 'filename');
    const profile = await this.model('VendorProfile').findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Submit your vendor profile before uploading documents');
    }
    const doc = await this.model('Document').create({
      data: { filename, status: 'pending', vendorProfileId: profile.id },
    });
    return { id: doc.id, filename: doc.filename, status: doc.status };
  }

  async listDocuments(userId: string): Promise<GetApiVendorDocumentsResponseDto[]> {
    const profile = await this.model('VendorProfile').findUnique({ where: { userId } });
    if (!profile) return [];
    const docs = await this.model('Document').findMany({
      where: { vendorProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => ({ id: d.id, filename: d.filename, status: d.status }));
  }
}
