import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

/** POST /api/invoices request/response and GET /api/invoices/:id/download response (contract shapes). */
export interface CreateInvoiceRequest { orderId: string; amount: number; }
export interface InvoiceResponse { id: string; orderId: string; amount: number; }
export interface InvoiceDownloadResponse { id: string; downloadUrl: string; }

export const INVOICES_PATH = '/api/invoices';

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page" data-testid="invoices-screen">
      <div class="page-header"><h1>Invoices</h1></div>

      <section class="card">
        <h2>Generate invoice</h2>
        <p class="muted">Generate an invoice for a confirmed order: the invoice is created and returns 201 with the invoice id available for download.</p>
        <form class="form-grid" data-testid="invoice-generate-form" (ngSubmit)="generate()">
          <label>Order id <input name="orderId" [(ngModel)]="orderId" required /></label>
          <label>Amount <input name="amount" type="number" step="0.01" min="0" [(ngModel)]="amount" required /></label>
          <button type="submit" [disabled]="busy">Generate invoice</button>
        </form>
        @if (created) {
          <p class="status" data-testid="invoice-created">Invoice created: <strong>{{ created.id }}</strong></p>
        }
        @if (generateError) {
          <p role="alert">{{ generateError }}</p>
        }
      </section>

      <section class="card invoice-viewer">
        <h2>Download invoice</h2>
        <p class="muted">Request the download link: the response returns 200 with a downloadUrl pointing to the stored invoice.</p>
        <form class="form-grid" data-testid="invoice-download-form" (ngSubmit)="download()">
          <label>Invoice id <input name="invoiceId" [(ngModel)]="invoiceId" required /></label>
          <button type="submit" [disabled]="busy">Get download link</button>
        </form>
        @if (downloadLink) {
          <p class="status" data-testid="invoice-download-link"><a [href]="downloadLink.downloadUrl" target="_blank" rel="noopener">Download invoice {{ downloadLink.id }}</a></p>
        }
        @if (downloadError) {
          <p role="alert">{{ downloadError }}</p>
        }
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class InvoicesComponent {
  private readonly api = inject(ApiClient);

  orderId = '';
  amount: number | null = null;
  invoiceId = '';
  busy = false;
  created: InvoiceResponse | null = null;
  downloadLink: InvoiceDownloadResponse | null = null;
  generateError = '';
  downloadError = '';

  constructor() {
    if (this.api instanceof MockApiClient) {
      const mock = this.api;
      mock.registerMock<InvoiceResponse>('POST', INVOICES_PATH, async (body) => {
        const b = (body ?? {}) as CreateInvoiceRequest;
        return { id: 'inv-' + Math.random().toString(36).slice(2, 10), orderId: b.orderId, amount: Number(b.amount) };
      });
      this.mockDownload = (id: string) => {
        mock.registerMock<InvoiceDownloadResponse>('GET', `${INVOICES_PATH}/${id}/download`, async () => ({
          id,
          downloadUrl: `https://storage.example.com/invoices/${id}.pdf`,
        }));
      };
    }
  }

  private mockDownload: ((id: string) => void) | null = null;

  async generate(): Promise<void> {
    this.generateError = '';
    this.created = null;
    if (!this.orderId || this.amount === null) {
      this.generateError = 'Order id and amount are required.';
      return;
    }
    this.busy = true;
    try {
      const body: CreateInvoiceRequest = { orderId: this.orderId.trim(), amount: Number(this.amount) };
      this.created = await this.api.post<InvoiceResponse>(INVOICES_PATH, body);
      if (this.created?.id) this.invoiceId = this.created.id;
    } catch (e: any) {
      this.generateError = e?.message || 'Failed to generate invoice.';
    } finally {
      this.busy = false;
    }
  }

  async download(): Promise<void> {
    this.downloadError = '';
    this.downloadLink = null;
    const id = this.invoiceId.trim();
    if (!id) {
      this.downloadError = 'Invoice id is required.';
      return;
    }
    this.busy = true;
    try {
      this.mockDownload?.(id);
      this.downloadLink = await this.api.get<InvoiceDownloadResponse>(`${INVOICES_PATH}/${id}/download`);
    } catch (e: any) {
      this.downloadError = e?.message || 'Failed to fetch download link.';
    } finally {
      this.busy = false;
    }
  }
}
