import { BadRequestException } from '@nestjs/common';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationPreferencesService } from './notification-preferences.service';

function makeService() {
  const rows = new Map<string, { userId: string; orderAlerts: boolean; messageAlerts: boolean }>();
  const db = {
    notificationPreference: {
      findUnique: jest.fn(async ({ where }: any) => rows.get(where.userId) ?? null),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = rows.get(where.userId);
        const row = existing ? { ...existing, ...update } : { ...create };
        rows.set(where.userId, row);
        return row;
      }),
    },
  };
  return new NotificationPreferencesService(db as any);
}

describe('NotificationPreferencesController', () => {
  const req = { session: { userId: 'u-1' } };

  it('returns defaults when no preferences are stored', async () => {
    const ctrl = new NotificationPreferencesController(makeService());
    await expect(ctrl.getApiNotificationsPreferences(req)).resolves.toEqual({
      userId: 'u-1', orderAlerts: true, messageAlerts: true,
    });
  });

  it('upserts and returns the stored record', async () => {
    const ctrl = new NotificationPreferencesController(makeService());
    await expect(
      ctrl.putApiNotificationsPreferences(req, { orderAlerts: true, messageAlerts: false }),
    ).resolves.toEqual({ userId: 'u-1', orderAlerts: true, messageAlerts: false });
    await expect(
      ctrl.putApiNotificationsPreferences(req, { orderAlerts: false, messageAlerts: false }),
    ).resolves.toEqual({ userId: 'u-1', orderAlerts: false, messageAlerts: false });
    await expect(ctrl.getApiNotificationsPreferences(req)).resolves.toEqual({
      userId: 'u-1', orderAlerts: false, messageAlerts: false,
    });
  });

  it('rejects non-boolean fields', async () => {
    const ctrl = new NotificationPreferencesController(makeService());
    await expect(
      ctrl.putApiNotificationsPreferences(req, { orderAlerts: 'yes' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
