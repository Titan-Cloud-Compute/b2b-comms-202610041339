import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

export interface ChannelSummary {
  id: string;
  name: string;
}

export interface ChannelMessage {
  id: string;
  body: string;
  channelId: string;
}

/** Registers in-memory handlers for the shared-channel endpoints when running against MockApiClient. */
function registerSharedChannelMocks(client: MockApiClient): void {
  const channels: ChannelSummary[] = [];
  let seq = 0;
  const uuid = () =>
    globalThis.crypto?.randomUUID?.() ?? `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  client.registerMock('GET', '/api/channels', async () => [...channels]);
  client.registerMock('POST', '/api/channels', async (body) => {
    const channel = { id: uuid(), name: String((body as { name?: string })?.name ?? '') };
    channels.unshift(channel);
    return channel;
  });
}

@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page" data-testid="channels-screen">
      <div class="page-header">
      <h1>Shared channels</h1>
      <p data-testid="channels-outcomes">
        When a vendor creates a shared channel, the channel is stored and displays in both the vendor and customer channel lists.
        When a customer posts in a channel, the message is stored and returns 201 with the created Message record.
      </p>
      </div>

      <div class="card">
      <form class="form-grid" data-testid="channel-create-form" (ngSubmit)="createChannel()">
        <label for="channel-name">Channel name</label>
        <input id="channel-name" name="name" [(ngModel)]="newName" required />
        <button type="submit" [disabled]="busy() || !newName.trim()">Create channel</button>
      </form>

      @if (error()) {
        <p role="alert" data-testid="channels-error">{{ error() }}</p>
      }
      @if (notice()) {
        <p role="status" data-testid="channels-notice">{{ notice() }}</p>
      }

      <ul class="item-list channel-list" data-testid="channel-list">
        @for (channel of channels(); track channel.id) {
          <li>
            <button type="button" (click)="select(channel)">{{ channel.name }}</button>
          </li>
        } @empty {
          <li class="muted">No channels yet.</li>
        }
      </ul>

      @if (selected(); as channel) {
        <form class="form-grid" data-testid="message-compose-form" (ngSubmit)="sendMessage()">
          <label for="message-body">Message to {{ channel.name }}</label>
          <textarea id="message-body" name="body" [(ngModel)]="messageBody" required></textarea>
          <button type="submit" [disabled]="busy() || !messageBody.trim()">Send</button>
        </form>
        <ul class="item-list" data-testid="message-list">
          @for (m of messages(); track m.id) {
            <li>{{ m.body }}</li>
          }
        </ul>
      }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .form-grid label { flex: 0 0 100%; }
    .channel-list > li { display: flex; }
    .channel-list > li > button { flex: 1 1 auto; justify-content: flex-start; }
  `],
})
export class ChannelsComponent implements OnInit {
  private readonly api = inject(ApiClient);

  readonly channels = signal<ChannelSummary[]>([]);
  readonly selected = signal<ChannelSummary | null>(null);
  readonly messages = signal<ChannelMessage[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  newName = '';
  messageBody = '';

  constructor() {
    if (this.api instanceof MockApiClient) {
      registerSharedChannelMocks(this.api);
    }
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      const list = await this.api.get<ChannelSummary[]>('/api/channels');
      this.channels.set(Array.isArray(list) ? list : []);
    } catch (e) {
      this.error.set((e as Error)?.message ?? 'Could not load channels');
    }
  }

  select(channel: ChannelSummary): void {
    this.selected.set(channel);
    this.messages.set([]);
  }

  async createChannel(): Promise<void> {
    const name = this.newName.trim();
    if (!name) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const created = await this.api.post<ChannelSummary>('/api/channels', { name });
      this.newName = '';
      this.notice.set(`Channel "${created?.name ?? name}" created.`);
      await this.load();
    } catch (e) {
      this.error.set((e as Error)?.message ?? 'Could not create channel');
    } finally {
      this.busy.set(false);
    }
  }

  async sendMessage(): Promise<void> {
    const channel = this.selected();
    const body = this.messageBody.trim();
    if (!channel || !body) return;
    this.busy.set(true);
    this.error.set(null);
    const path = `/api/channels/${channel.id}/messages`;
    if (this.api instanceof MockApiClient) {
      this.api.registerMock('POST', path, async (b) => ({
        id: `${Date.now()}`,
        body: String((b as { body?: string })?.body ?? ''),
        channelId: channel.id,
      }));
    }
    try {
      const message = await this.api.post<ChannelMessage>(path, { body });
      this.messageBody = '';
      this.messages.update((list) => [...list, message]);
      this.notice.set('Message sent.');
    } catch (e) {
      this.error.set((e as Error)?.message ?? 'Could not send message');
    } finally {
      this.busy.set(false);
    }
  }
}
