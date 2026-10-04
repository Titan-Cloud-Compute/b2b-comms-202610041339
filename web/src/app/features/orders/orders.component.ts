import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';
import { AuthService } from '../../shared/auth.service';

interface OrderRow {
  id: string;
  status: string;
  customerId?: string;
}

interface ItemRow {
  description: string;
  quantity: number;
  unitPrice: number;
}

export const CREATE_OUTCOME =
  'the order is stored with status "pending" and returns 201 with the created Order record';
export const CONFIRM_OUTCOME =
  'the order is updated to status "confirmed" and displays to the customer as confirmed';

/** In-memory mocks so the screen works against MockApiClient before the backend lands. */
function registerOrderMocks(client: MockApiClient): void {
  const orders: OrderRow[] = [];
  client.registerMock('GET', '/api/orders', async () => orders.map((o) => ({ id: o.id, status: o.status })));
  client.registerMock('POST', '/api/orders', async () => {
    const order = { id: crypto.randomUUID(), status: 'pending', customerId: 'mock-customer' };
    orders.unshift(order);
    client.registerMock('PATCH', `/api/orders/${order.id}/confirm`, async () => {
      order.status = 'confirmed';
      return { id: order.id, status: order.status };
    });
    return order;
  });
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page" data-testid="orders-screen">
      <div class="page-header"><h1>Orders</h1></div>

      <section class="card" data-testid="order-workflow">
        <h2>How ordering works</h2>
        <ul class="bullet-list">
          <li>Place a purchase order: {{ createOutcome }}.</li>
          <li>Vendor confirmation: {{ confirmOutcome }}.</li>
        </ul>
      </section>

      @if (message()) {
        <p data-testid="order-message" role="status">{{ message() }}</p>
      }
      @if (error()) {
        <p data-testid="order-error" role="alert">{{ error() }}</p>
      }

      <section class="card">
        <h2>Your orders</h2>
        @if (orders().length === 0) {
          <p class="muted" data-testid="orders-empty">No orders yet.</p>
        } @else {
          <div class="table-wrap"><table class="data-table" data-testid="orders-list">
            <thead>
              <tr><th>Order</th><th>Status</th>@if (isVendor()) {<th>Confirm</th>}</tr>
            </thead>
            <tbody>
              @for (o of orders(); track o.id) {
                <tr [attr.data-testid]="'order-row-' + o.id">
                  <td>{{ o.id }}</td>
                  <td data-testid="order-status">{{ o.status }}</td>
                  @if (isVendor()) {
                    <td>
                      @if (o.status === 'pending') {
                        <input
                          type="date"
                          data-testid="order-estimated-delivery"
                          [(ngModel)]="deliveryDates[o.id]"
                          [name]="'delivery-' + o.id"
                          aria-label="Estimated delivery"
                        />
                        <button
                          type="button"
                          data-testid="order-confirm"
                          [disabled]="!deliveryDates[o.id] || busy()"
                          (click)="confirm(o)"
                        >Confirm</button>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table></div>
        }
      </section>

      <section class="card">
        <h2>New purchase order</h2>
        <form class="form-grid" data-testid="order-create-form" (ngSubmit)="submit()">
          <label>
            Vendor ID
            <input name="vendorId" data-testid="order-vendor-id" [(ngModel)]="vendorId" required />
          </label>
          @for (item of items; track $index) {
            <fieldset>
              <input [name]="'desc-' + $index" placeholder="Description" [(ngModel)]="item.description" aria-label="Description" />
              <input [name]="'qty-' + $index" type="number" min="1" step="1" [(ngModel)]="item.quantity" aria-label="Quantity" />
              <input [name]="'price-' + $index" type="number" min="0" step="0.01" [(ngModel)]="item.unitPrice" aria-label="Unit price" />
              @if (items.length > 1) {
                <button type="button" class="btn-secondary" (click)="removeItem($index)">Remove</button>
              }
            </fieldset>
          }
          <button type="button" class="btn-secondary" (click)="addItem()">Add item</button>
          <button type="submit" data-testid="order-submit" [disabled]="!vendorId || busy()">Submit order</button>
        </form>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    fieldset {
      flex: 1 1 100%;
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin: 0;
      padding: var(--space-4);
      border: 1px solid var(--color-border-light);
      border-radius: var(--radius-md);
      background: var(--color-bg-secondary);
    }
    fieldset input { flex: 1 1 10rem; width: auto; }
    .data-table td input { width: auto; margin-right: var(--space-2); }
  `],
})
export class OrdersComponent implements OnInit {
  private api = inject(ApiClient);
  private auth = inject(AuthService);

  readonly createOutcome = CREATE_OUTCOME;
  readonly confirmOutcome = CONFIRM_OUTCOME;

  orders = signal<OrderRow[]>([]);
  message = signal<string>('');
  error = signal<string>('');
  busy = signal(false);

  vendorId = '';
  items: ItemRow[] = [this.blankItem()];
  deliveryDates: Record<string, string> = {};

  constructor() {
    if (this.api instanceof MockApiClient) registerOrderMocks(this.api);
  }

  ngOnInit(): void {
    void this.load();
  }

  isVendor(): boolean {
    const user = this.auth.user() as { role?: string } | null;
    return user?.role === 'VENDOR';
  }

  async load(): Promise<void> {
    try {
      const rows = await this.api.get<OrderRow[]>('/api/orders');
      this.orders.set(Array.isArray(rows) ? rows : []);
    } catch {
      this.orders.set([]);
    }
  }

  addItem(): void {
    this.items = [...this.items, this.blankItem()];
  }

  removeItem(i: number): void {
    this.items = this.items.filter((_, idx) => idx !== i);
  }

  async submit(): Promise<void> {
    if (!this.vendorId) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const created = await this.api.post<OrderRow>('/api/orders', {
        vendorId: this.vendorId,
        items: this.items
          .filter((i) => i.description.trim())
          .map((i) => ({ description: i.description.trim(), quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
      });
      this.orders.update((list) => [{ ...created, status: created.status ?? 'pending' }, ...list.filter((o) => o.id !== created.id)]);
      this.message.set(`Order ${created.id} placed: ${CREATE_OUTCOME}.`);
      this.vendorId = '';
      this.items = [this.blankItem()];
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not place order');
    } finally {
      this.busy.set(false);
    }
  }

  async confirm(order: OrderRow): Promise<void> {
    const estimatedDelivery = this.deliveryDates[order.id];
    if (!estimatedDelivery) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const updated = await this.api.patch<OrderRow>(`/api/orders/${order.id}/confirm`, { estimatedDelivery });
      this.orders.update((list) =>
        list.map((o) => (o.id === order.id ? { ...o, status: updated?.status ?? 'confirmed' } : o)),
      );
      this.message.set(`Order ${order.id} confirmed for ${estimatedDelivery}: ${CONFIRM_OUTCOME}.`);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not confirm order');
    } finally {
      this.busy.set(false);
    }
  }

  private blankItem(): ItemRow {
    return { description: '', quantity: 1, unitPrice: 0 };
  }
}
