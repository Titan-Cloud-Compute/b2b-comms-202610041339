import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Put, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireUser, RolesGuard } from '../../auth/roles.guard';
import { NotificationPreferencesService } from './notification-preferences.service';
import {
  GetApiNotificationsPreferencesResponseDto,
  PutApiNotificationsPreferencesRequestDto,
  PutApiNotificationsPreferencesResponseDto,
} from './notification-preferences.dto';

type SessionRequest = { session?: { userId: string } };

@ApiTags('notification-preferences')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireUser()
@Controller('api/notifications/preferences')
export class NotificationPreferencesController {
  constructor(private readonly notificationpreferences: NotificationPreferencesService) {}

  @Put()
  @HttpCode(HttpStatus.OK)
  async putApiNotificationsPreferences(
    @Req() req: SessionRequest,
    @Body() body: PutApiNotificationsPreferencesRequestDto,
  ): Promise<PutApiNotificationsPreferencesResponseDto> {
    if (!body || typeof body.orderAlerts !== 'boolean' || typeof body.messageAlerts !== 'boolean') {
      throw new BadRequestException('orderAlerts and messageAlerts must be booleans');
    }
    return this.notificationpreferences.upsert(req.session!.userId, {
      orderAlerts: body.orderAlerts,
      messageAlerts: body.messageAlerts,
    });
  }

  @Get()
  async getApiNotificationsPreferences(
    @Req() req: SessionRequest,
  ): Promise<GetApiNotificationsPreferencesResponseDto> {
    return this.notificationpreferences.get(req.session!.userId);
  }
}
