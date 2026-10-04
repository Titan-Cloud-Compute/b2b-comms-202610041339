import { Injectable } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  GetApiAdminAuditLogResponseDto,
  PostApiAdminAuditLogRequestDto,
  PostApiAdminAuditLogResponseDto,
} from './audit-log.dto';

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

@Injectable()
export class AuditLogService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['AuditEntry']);
  }

  /** All AuditEntry records, oldest first. */
  async list(): Promise<GetApiAdminAuditLogResponseDto[]> {
    const rows = await this.model('AuditEntry').findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      userId: r.userId,
      createdAt: toIso(r.createdAt),
    }));
  }

  /** Persist a new AuditEntry and return the created record. */
  async record(dto: PostApiAdminAuditLogRequestDto): Promise<PostApiAdminAuditLogResponseDto & { userId: string }> {
    const r = await this.model('AuditEntry').create({
      data: { action: dto.action, userId: dto.userId },
    });
    return { id: r.id, action: r.action, userId: r.userId, createdAt: toIso(r.createdAt) };
  }
}
