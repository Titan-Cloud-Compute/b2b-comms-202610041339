import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

/** AuditEntry as returned by GET /api/admin/audit-log. */
export interface AuditEntry {
  id: string;
  action: string;
  userId: string;
  createdAt: string;
}

/** Request body for POST /api/admin/audit-log. */
export interface RecordAuditEntryRequest {
  action: string;
  userId: string;
}

const AUDIT_LOG_PATH = '/api/admin/audit-log';

function byCreatedAtAsc(a: AuditEntry, b: AuditEntry): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

@Component({
  selector: 'app-admin-audit-log',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page" data-testid="admin-audit-log-screen">
      <div class="page-header">
        <h1>Audit Log</h1>
        <p data-testid="audit-log-view-outcome">a list of AuditEntry records is displayed in chronological order returns 200</p>
      </div>

      @if (error()) {
        <p role="alert" data-testid="audit-log-error">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="muted" data-testid="audit-log-loading">Loading…</p>
      } @else if (entries().length === 0) {
        <p class="muted" data-testid="audit-log-empty">No audit entries yet.</p>
      } @else {
        <div class="table-scroll"><table class="data-table" data-testid="audit-log-table">
          <thead>
            <tr><th>When</th><th>Action</th><th>User</th><th>ID</th></tr>
          </thead>
          <tbody>
            @for (e of entries(); track e.id) {
              <tr data-testid="audit-log-row">
                <td>{{ e.createdAt }}</td>
                <td>{{ e.action }}</td>
                <td>{{ e.userId }}</td>
                <td>{{ e.id }}</td>
              </tr>
            }
          </tbody>
        </table></div>
      }

      <section class="card">
      <h2>Record entry</h2>
      <p class="muted" data-testid="audit-log-record-outcome">the AuditEntry is stored and returns 201 with the created record</p>
      <form class="form-grid" data-testid="audit-log-record-form" (ngSubmit)="record()">
        <label>Action <input name="action" [(ngModel)]="action" required /></label>
        <label>User ID <input name="userId" [(ngModel)]="userId" required /></label>
        <button type="submit" [disabled]="saving() || !action.trim() || !userId.trim()">Record</button>
      </form>
      @if (lastCreated(); as c) {
        <p class="status" data-testid="audit-log-created">Recorded {{ c.action }} ({{ c.id }})</p>
      }
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class AdminAuditLogComponent implements OnInit {
  private readonly api = inject(ApiClient);

  readonly entries = signal<AuditEntry[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastCreated = signal<AuditEntry | null>(null);

  action = '';
  userId = '';

  constructor() {
    if (this.api instanceof MockApiClient) registerAuditLogMocks(this.api);
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const rows = await this.api.get<AuditEntry[]>(AUDIT_LOG_PATH);
      this.entries.set(Array.isArray(rows) ? [...rows].sort(byCreatedAtAsc) : []);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load audit log');
      this.entries.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async record(): Promise<void> {
    const body: RecordAuditEntryRequest = { action: this.action.trim(), userId: this.userId.trim() };
    if (!body.action || !body.userId) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const created = await this.api.post<Partial<AuditEntry>>(AUDIT_LOG_PATH, body);
      if (created && created.id) {
        const entry: AuditEntry = {
          id: created.id,
          action: created.action ?? body.action,
          userId: created.userId ?? body.userId,
          createdAt: created.createdAt ?? new Date().toISOString(),
        };
        this.entries.set([...this.entries(), entry].sort(byCreatedAtAsc));
        this.lastCreated.set(entry);
      }
      this.action = '';
      this.userId = '';
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to record audit entry');
    } finally {
      this.saving.set(false);
    }
  }
}

const mockEntries: AuditEntry[] = [];

function registerAuditLogMocks(client: MockApiClient): void {
  client.registerMock('GET', AUDIT_LOG_PATH, async () => [...mockEntries].sort(byCreatedAtAsc));
  client.registerMock('POST', AUDIT_LOG_PATH, async (body) => {
    const b = (body ?? {}) as RecordAuditEntryRequest;
    const entry: AuditEntry = {
      id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
      action: b.action,
      userId: b.userId,
      createdAt: new Date().toISOString(),
    };
    mockEntries.push(entry);
    return entry;
  });
}
