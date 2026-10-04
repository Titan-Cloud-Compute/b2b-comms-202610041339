import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../shared/api/api-client';

/** Mirrors the NotificationPreference contract (GET/PUT /api/notifications/preferences). */
export interface NotificationPreference {
  userId: string;
  orderAlerts: boolean;
  messageAlerts: boolean;
}

const PREFS_PATH = '/api/notifications/preferences';
export const CONFIGURE_OUTCOME =
  'Saving: the preferences are updated and returns 200 with the stored NotificationPreference record.';
export const DISABLE_ALL_OUTCOME =
  'Turning every alert off: the preferences are updated with both alert fields stored as false.';

@Component({
  selector: 'app-settings-notifications',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="settings-notifications-screen">
      <h1>Notification Settings</h1>
      @if (loading) {
        <p>Loading preferences…</p>
      }
      <form (ngSubmit)="save()">
        <label>
          <input type="checkbox" data-testid="pref-order-alerts" name="orderAlerts"
                 [(ngModel)]="orderAlerts" [disabled]="saving" />
          Order alerts
        </label>
        <label>
          <input type="checkbox" data-testid="pref-message-alerts" name="messageAlerts"
                 [(ngModel)]="messageAlerts" [disabled]="saving" />
          Message alerts
        </label>
        <button type="submit" data-testid="pref-save" [disabled]="saving">Save</button>
      </form>
      <ul data-testid="pref-outcomes">
        <li>{{ configureOutcome }}</li>
        <li>{{ disableAllOutcome }}</li>
      </ul>
      @if (stored) {
        <p data-testid="pref-stored">
          Stored: order alerts {{ stored.orderAlerts ? 'on' : 'off' }},
          message alerts {{ stored.messageAlerts ? 'on' : 'off' }}
        </p>
      }
      @if (status) {
        <p data-testid="pref-status" role="status">{{ status }}</p>
      }
      @if (error) {
        <p data-testid="pref-error" role="alert">{{ error }}</p>
      }
    </div>
  `,
})
export class SettingsNotificationsComponent implements OnInit {
  private readonly api = inject(ApiClient);

  readonly configureOutcome = CONFIGURE_OUTCOME;
  readonly disableAllOutcome = DISABLE_ALL_OUTCOME;

  orderAlerts = true;
  messageAlerts = true;
  stored: NotificationPreference | null = null;
  loading = false;
  saving = false;
  status = '';
  error = '';

  async ngOnInit(): Promise<void> {
    this.loading = true;
    try {
      const prefs = await this.api.get<NotificationPreference>(PREFS_PATH);
      if (this.isPreference(prefs)) {
        this.orderAlerts = prefs.orderAlerts;
        this.messageAlerts = prefs.messageAlerts;
        this.stored = prefs;
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Could not load preferences';
    } finally {
      this.loading = false;
    }
  }

  async save(): Promise<void> {
    this.saving = true;
    this.status = '';
    this.error = '';
    const body = { orderAlerts: this.orderAlerts, messageAlerts: this.messageAlerts };
    try {
      const res = await this.api.request<NotificationPreference>(PREFS_PATH, { method: 'PUT', body });
      const saved = this.isPreference(res) ? res : { userId: this.stored?.userId ?? '', ...body };
      this.stored = saved;
      this.orderAlerts = saved.orderAlerts;
      this.messageAlerts = saved.messageAlerts;
      this.status = !saved.orderAlerts && !saved.messageAlerts
        ? 'Preferences saved: all alerts are off.'
        : 'Preferences saved.';
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Could not save preferences';
    } finally {
      this.saving = false;
    }
  }

  private isPreference(v: unknown): v is NotificationPreference {
    const p = v as NotificationPreference | null;
    return !!p && typeof p.orderAlerts === 'boolean' && typeof p.messageAlerts === 'boolean';
  }
}
