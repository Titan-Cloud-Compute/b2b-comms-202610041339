import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, ApiError, ConflictError, MockApiClient } from '../../shared/api/api-client';

interface CustomerListItem {
  id: string;
  email: string;
}

interface InviteResponse {
  customerId: string;
  email: string;
  invitationSent: boolean;
}

const LIST_PATH = '/api/admin/customers';
const INVITE_PATH = '/api/admin/customers/invite';

/** Register in-memory mocks for the customer-invite endpoints (USE_MOCKS mode). */
function registerCustomerInviteMocks(client: MockApiClient): void {
  const customers: CustomerListItem[] = [];
  client.registerMock('GET', LIST_PATH, async () => customers.map((c) => ({ ...c })));
  client.registerMock('POST', INVITE_PATH, async (body) => {
    const email = String((body as { email?: string } | undefined)?.email ?? '').trim().toLowerCase();
    if (customers.some((c) => c.email === email)) {
      throw new ConflictError('Customer already exists');
    }
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${customers.length}`;
    customers.push({ id, email });
    return { customerId: id, email, invitationSent: true } as InviteResponse;
  });
}

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page" data-testid="admin-customers-screen">
      <div class="page-header"><h1>Customer Management</h1></div>

      <section class="card">
        <h2>Invite a customer</h2>
        <form class="form-grid" data-testid="customer-invite-form" (ngSubmit)="invite()">
          <label>
            Email
            <input
              type="email"
              name="email"
              data-testid="customer-invite-email"
              [(ngModel)]="email"
              required
            />
          </label>
          <button type="submit" data-testid="customer-invite-submit" [disabled]="submitting()">Invite</button>
        </form>

        @if (result(); as r) {
          <p class="status" data-testid="customer-invite-success">
            Invitation sent to {{ r.email }} (customer {{ r.customerId }}, invitationSent: {{ r.invitationSent }})
          </p>
        }
        @if (error(); as e) {
          <p data-testid="customer-invite-error" role="alert">{{ e }}</p>
        }

        <ul class="bullet-list" data-testid="customer-invite-scenarios">
          <li>Invite: a Customer record is created and returns 201 with invitationSent true</li>
          <li>Duplicate invite: the response returns 409 error indicating the customer already exists</li>
        </ul>
      </section>

      <section class="card">
        <h2>Customers</h2>
        @if (customers().length === 0) {
          <p class="muted" data-testid="customer-list-empty">No customers yet.</p>
        } @else {
          <div class="table-wrap"><table class="data-table" data-testid="customer-list">
            <thead><tr><th>ID</th><th>Email</th></tr></thead>
            <tbody>
              @for (c of customers(); track c.id) {
                <tr><td>{{ c.id }}</td><td>{{ c.email }}</td></tr>
              }
            </tbody>
          </table></div>
        }
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class AdminCustomersComponent implements OnInit {
  private readonly api = inject(ApiClient);

  email = '';
  readonly customers = signal<CustomerListItem[]>([]);
  readonly result = signal<InviteResponse | null>(null);
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  constructor() {
    if (this.api instanceof MockApiClient) {
      registerCustomerInviteMocks(this.api);
    }
  }

  ngOnInit(): void {
    void this.loadCustomers();
  }

  async loadCustomers(): Promise<void> {
    try {
      const list = await this.api.get<CustomerListItem[]>(LIST_PATH);
      this.customers.set(Array.isArray(list) ? list : []);
    } catch {
      this.customers.set([]);
    }
  }

  async invite(): Promise<void> {
    const email = this.email.trim();
    if (!email) return;
    this.submitting.set(true);
    this.result.set(null);
    this.error.set(null);
    try {
      const res = await this.api.post<InviteResponse>(INVITE_PATH, { email });
      this.result.set(res);
      this.email = '';
      await this.loadCustomers();
    } catch (err) {
      if (err instanceof ConflictError || (err instanceof ApiError && err.status === 409)) {
        this.error.set(`409: a customer with email ${email} already exists`);
      } else {
        this.error.set(err instanceof Error ? err.message : 'Invitation failed');
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
