import { BadRequestException, Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { AuditLogService } from './audit-log.service';
import type { PostApiAdminAuditLogRequestDto } from './audit-log.dto';

/** Validate the POST body: action and userId must be non-empty strings. */
export function parseRecordAuditEntry(body: unknown): PostApiAdminAuditLogRequestDto {
  const b = (body ?? {}) as Record<string, unknown>;
  const action = typeof b.action === 'string' ? b.action.trim() : '';
  const userId = typeof b.userId === 'string' ? b.userId.trim() : '';
  if (!action) throw new BadRequestException('action must be a non-empty string');
  if (!userId) throw new BadRequestException('userId must be a non-empty string');
  return { action, userId };
}

@ApiTags('audit-log')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('api/admin/audit-log')
export class AuditLogController {
  constructor(private readonly auditlog: AuditLogService) {}

  /** GET /api/admin/audit-log — AuditEntry records, oldest first. */
  @Get()
  async getApiAdminAuditLog() {
    return this.auditlog.list();
  }

  /** POST /api/admin/audit-log — record an AuditEntry; 201 with the created record. */
  @Post()
  @HttpCode(201)
  async postApiAdminAuditLog(@Body() body: unknown) {
    return this.auditlog.record(parseRecordAuditEntry(body));
  }
}
