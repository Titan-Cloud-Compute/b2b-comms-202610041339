import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import type { SessionPayload } from '../../auth/session.types';
import { SharedChannelService } from './shared-channel.service';
import type { PostApiChannelsIdMessagesRequestDto, PostApiChannelsRequestDto } from './shared-channel.dto';

function sessionOf(req: Request): SessionPayload {
  if (!req.session) throw new UnauthorizedException('not authenticated');
  return req.session;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${field} is required`);
  }
  return value.trim();
}

@ApiTags('shared-channel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/channels')
export class SharedChannelController {
  constructor(private readonly sharedchannel: SharedChannelService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.VENDOR)
  async postApiChannels(@Req() req: Request, @Body() body: PostApiChannelsRequestDto) {
    return this.sharedchannel.createChannel(sessionOf(req), requiredString(body?.name, 'name'));
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.VENDOR, UserRole.CUSTOMER)
  async postApiChannelsIdMessages(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: PostApiChannelsIdMessagesRequestDto,
  ) {
    return this.sharedchannel.postMessage(sessionOf(req), id, requiredString(body?.body, 'body'));
  }

  @Get()
  @Roles(UserRole.VENDOR, UserRole.CUSTOMER)
  async getApiChannels(@Req() req: Request) {
    return this.sharedchannel.listChannels(sessionOf(req));
  }
}
