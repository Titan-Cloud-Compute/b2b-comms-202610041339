import { Injectable } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetApiNotificationsPreferencesResponseDto,
  PutApiNotificationsPreferencesRequestDto,
  PutApiNotificationsPreferencesResponseDto,
} from './notification-preferences.dto';

const DEFAULTS = { orderAlerts: true, messageAlerts: true };

@Injectable()
export class NotificationPreferencesService extends FeatureService {
  constructor(private readonly db: PrismaService) {
    super(db, []);
  }

  /** Read the user's preferences, falling back to defaults when none are stored. */
  async get(userId: string): Promise<GetApiNotificationsPreferencesResponseDto> {
    const row = await this.db.notificationPreference.findUnique({ where: { userId } });
    if (!row) return { userId, ...DEFAULTS };
    return { userId: row.userId, orderAlerts: row.orderAlerts, messageAlerts: row.messageAlerts };
  }

  /** Create or update the user's preferences and return the stored record. */
  async upsert(
    userId: string,
    dto: PutApiNotificationsPreferencesRequestDto,
  ): Promise<PutApiNotificationsPreferencesResponseDto> {
    const data = { orderAlerts: dto.orderAlerts, messageAlerts: dto.messageAlerts };
    const row = await this.db.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return { userId: row.userId, orderAlerts: row.orderAlerts, messageAlerts: row.messageAlerts };
  }
}
