import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { InvoiceGenerationService } from './invoice-generation.service';
import type {
  GetApiInvoicesIdDownloadResponseDto,
  PostApiInvoicesRequestDto,
  PostApiInvoicesResponseDto,
} from './invoice-generation.dto';

@ApiTags('invoice-generation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/invoices')
export class InvoiceGenerationController {
  constructor(private readonly invoicegeneration: InvoiceGenerationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.VENDOR)
  async postApiInvoices(
    @Body() body: PostApiInvoicesRequestDto,
    @Req() req: Request,
  ): Promise<PostApiInvoicesResponseDto> {
    if (!req.session) throw new UnauthorizedException();
    return this.invoicegeneration.createInvoice(req.session.userId, body);
  }

  @Get(':id/download')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CUSTOMER, UserRole.VENDOR)
  async getApiInvoicesIdDownload(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<GetApiInvoicesIdDownloadResponseDto> {
    if (!req.session) throw new UnauthorizedException();
    return this.invoicegeneration.getDownload(req.session.userId, req.session.role, id);
  }
}
