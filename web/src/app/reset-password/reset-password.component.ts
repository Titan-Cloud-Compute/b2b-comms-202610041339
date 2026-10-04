import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AuthApi } from '../shared/api/auth-api.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="reset-page">
      <div class="reset-container">
        <div class="form-panel">
          <div class="form-container">
            <h2 class="form-title">Set New Password</h2>
            <p class="form-subtitle">Enter your new password below.</p>

            <form (ngSubmit)="onSubmit()" class="reset-form">
              @if (error()) {
                <div class="error-message">{{ error() }}</div>
              }
              <div class="form-group">
                <label for="password">New Password</label>
                <input
                  type="password"
                  id="password"
                  [(ngModel)]="password"
                  name="password"
                  placeholder="••••••••"
                  required
                  autocomplete="new-password"
                />
              </div>
              <button type="submit" class="btn-primary" [disabled]="isLoading()">
                @if (isLoading()) {
                  Saving…
                } @else {
                  Reset Password
                }
              </button>
            </form>

            <p class="back-link">
              <a routerLink="/login">Back to Sign In</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .reset-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-bg-secondary);
    }
    .reset-container { width: 100%; max-width: 440px; padding: var(--space-4); }
    .form-panel {
      background: white;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
      padding: var(--space-8);
    }
    .form-title { margin: 0 0 var(--space-2); font-size: var(--font-size-xl); font-weight: 700; color: var(--color-text-primary); }
    .form-subtitle { margin: 0 0 var(--space-6); color: var(--color-text-secondary); }
    .form-group { margin-bottom: var(--space-4); }
    .form-group label { display: block; margin-bottom: var(--space-1); font-weight: 500; color: var(--color-text-primary); }
    .form-group input {
      width: 100%; box-sizing: border-box;
      padding: var(--space-2-5) var(--space-3-5);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-base);
      color: var(--color-text-primary);
    }
    .btn-primary {
      width: 100%; padding: var(--space-3); margin-top: var(--space-2);
      background: var(--color-primary);
      color: var(--color-on-primary);
      border: none; border-radius: var(--radius-btn);
      font-size: var(--font-size-base); font-weight: 600; cursor: pointer;
    }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .error-message { color: var(--color-error); margin-bottom: var(--space-4); }
    .back-link { text-align: center; margin-top: var(--space-5); color: var(--color-text-secondary); }
    .back-link a { color: var(--color-primary); text-decoration: none; }
  `]
})
export class ResetPasswordComponent implements OnInit {
  password = '';
  isLoading = signal(false);
  error = signal<string | null>(null);
  private token = '';

  private authApi = inject(AuthApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
  }

  async onSubmit() {
    if (!this.password) { this.error.set('Password is required'); return; }
    if (this.password.length < 4) { this.error.set('Password is too short'); return; }
    this.isLoading.set(true);
    this.error.set(null);
    try {
      await this.authApi.confirmPasswordReset(this.token, this.password);
      this.router.navigate(['/login']);
    } catch {
      this.error.set('Something went wrong. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
