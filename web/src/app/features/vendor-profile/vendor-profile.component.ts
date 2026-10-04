import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../shared/api/api-client';

/** VendorProfile as returned by POST /api/vendor/profile. */
export interface VendorProfile {
  id: string;
  companyName: string;
  contactEmail: string;
}

/** Document as returned by POST/GET /api/vendor/documents. */
export interface VendorDocument {
  id: string;
  filename: string;
  status: string;
}

@Component({
  selector: 'app-vendor-profile',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page" data-testid="vendor-profile-screen">
      <div class="page-header"><h1>Vendor Profile</h1></div>

      <section class="card">
        <h2>Company profile</h2>
        <p class="muted">When you submit, the profile is stored and returns 201 with the created VendorProfile record.</p>
        <form class="form-grid" data-testid="vendor-profile-form" (ngSubmit)="submitProfile()">
          <label>
            Company name
            <input name="companyName" [(ngModel)]="companyName" required />
          </label>
          <label>
            Contact email
            <input name="contactEmail" type="email" [(ngModel)]="contactEmail" required />
          </label>
          <button type="submit" [disabled]="savingProfile()">Submit profile</button>
        </form>
        @if (profileError()) {
          <p role="alert">{{ profileError() }}</p>
        }
        @if (profile(); as p) {
          <div data-testid="vendor-profile-result">
            <p>Profile saved: {{ p.companyName }} ({{ p.contactEmail }}) — id {{ p.id }}</p>
          </div>
        }
      </section>

      <section class="card">
        <h2>Compliance documents</h2>
        <p class="muted">When you upload, the document is stored with status "pending" and displays in the vendor document library.</p>
        <form class="form-grid" data-testid="vendor-document-form" (ngSubmit)="uploadDocument()">
          <label>
            Filename
            <input name="filename" [(ngModel)]="filename" required />
          </label>
          <button type="submit" [disabled]="uploading()">Upload document</button>
        </form>
        @if (documentError()) {
          <p role="alert">{{ documentError() }}</p>
        }
        <ul class="item-list" data-testid="vendor-document-library">
          @for (doc of documents(); track doc.id) {
            <li>{{ doc.filename }} — {{ doc.status }}</li>
          } @empty {
            <li>No documents uploaded yet.</li>
          }
        </ul>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class VendorProfileComponent implements OnInit {
  private readonly api = inject(ApiClient);

  companyName = '';
  contactEmail = '';
  filename = '';

  readonly profile = signal<VendorProfile | null>(null);
  readonly documents = signal<VendorDocument[]>([]);
  readonly savingProfile = signal(false);
  readonly uploading = signal(false);
  readonly profileError = signal('');
  readonly documentError = signal('');

  ngOnInit(): void {
    void this.loadDocuments();
  }

  async submitProfile(): Promise<void> {
    if (!this.companyName.trim() || !this.contactEmail.trim()) {
      this.profileError.set('Company name and contact email are required.');
      return;
    }
    this.savingProfile.set(true);
    this.profileError.set('');
    try {
      const created = await this.api.post<VendorProfile>('/api/vendor/profile', {
        companyName: this.companyName.trim(),
        contactEmail: this.contactEmail.trim(),
      });
      this.profile.set(created);
    } catch (e: any) {
      this.profileError.set(e?.message || 'Could not save profile.');
    } finally {
      this.savingProfile.set(false);
    }
  }

  async uploadDocument(): Promise<void> {
    if (!this.filename.trim()) {
      this.documentError.set('Filename is required.');
      return;
    }
    this.uploading.set(true);
    this.documentError.set('');
    try {
      await this.api.post<VendorDocument>('/api/vendor/documents', { filename: this.filename.trim() });
      this.filename = '';
      await this.loadDocuments();
    } catch (e: any) {
      this.documentError.set(e?.message || 'Could not upload document.');
    } finally {
      this.uploading.set(false);
    }
  }

  private async loadDocuments(): Promise<void> {
    try {
      const docs = await this.api.get<VendorDocument[]>('/api/vendor/documents');
      this.documents.set(Array.isArray(docs) ? docs : []);
    } catch {
      this.documents.set([]);
    }
  }
}
