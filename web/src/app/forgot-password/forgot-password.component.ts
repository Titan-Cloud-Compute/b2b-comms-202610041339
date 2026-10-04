import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthApi } from '../shared/api/auth-api.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="forgot-page">
      <div class="forgot-container">
        <div class="form-panel">
          <div class="form-container">
            <h2 class="form-title">Forgot Password</h2>
            <p class="form-subtitle">Enter your email and we will send you a reset link.</p>

            @if (successMessage()) {
              <div class="success-message">
                Check your email — we sent you a password reset link.
              </div>
            } @else {
              <form (ngSubmit)="onSubmit()" class="forgot-form">
                @if (error()) {
                  <div class="error-message">{{ error() }}</div>
                }
                <div class="form-group">
                  <label for="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    [(ngModel)]="email"
                    name="email"
                    placeholder="you@example.com"
                    required
                    autocomplete="email"
                  />
                </div>
                <button type="submit" class="btn-primary" [disabled]="isLoading()">
                  @if (isLoading()) {
                    Sending…
                  } @else {
                    Send Reset Link
                  }
                </button>
              </form>
            }

            <p class="back-link">
              <a routerLink="/login">Back to Sign In</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .forgot-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-bg-secondary);
    }
    .forgot-container { width: 100%; max-width: 440px; padding: var(--space-4); }
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
    .success-message { color: var(--color-success); padding: var(--space-4); background: var(--color-success-50); border-radius: var(--radius-sm); margin-bottom: var(--space-4); }
    .back-link { text-align: center; margin-top: var(--space-5); color: var(--color-text-secondary); }
    .back-link a { color: var(--color-primary); text-decoration: none; }
  `]
})
export class ForgotPasswordComponent {
  email = '';
  isLoading = signal(false);
  error = signal<string | null>(null);
  successMessage = signal(false);

  private authApi = inject(AuthApi);

  async onSubmit() {
    if (!this.email) { this.error.set('Email is required'); return; }
    this.isLoading.set(true);
    this.error.set(null);
    try {
      await this.authApi.requestPasswordReset(this.email);
      this.successMessage.set(true);
    } catch {
      this.error.set('Something went wrong. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
