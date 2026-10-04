import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { OrderManagementService } from './order-management.service';
import type {
  GetApiOrdersResponseDto,
  PatchApiOrdersIdConfirmRequestDto,
  PatchApiOrdersIdConfirmResponseDto,
  PostApiOrdersRequestDto,
  PostApiOrdersResponseDto,
} from './order-management.dto';

@ApiTags('order-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/orders')
export class OrderManagementController {
  constructor(private readonly ordermanagement: OrderManagementService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  async postApiOrders(
    @Req() req: Request,
    @Body() body: PostApiOrdersRequestDto,
  ): Promise<PostApiOrdersResponseDto> {
    return this.ordermanagement.create(req.session!.userId, body);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.VENDOR)
  async patchApiOrdersIdConfirm(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: PatchApiOrdersIdConfirmRequestDto,
  ): Promise<PatchApiOrdersIdConfirmResponseDto> {
    return this.ordermanagement.confirm(req.session!.userId, id, body);
  }

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.VENDOR)
  async getApiOrders(@Req() req: Request): Promise<GetApiOrdersResponseDto[]> {
    return this.ordermanagement.list(req.session!.userId, req.session!.role);
  }
}
