import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HostAuthService } from '../services/host-auth.service';
import { SlidoSocketService } from '../services/slido-socket.service';

@Component({
  selector: 'app-host-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-shell">
      <div class="auth-card">
        <h1>{{ mode() === 'login' ? 'Host Sign In' : 'Create Host Account' }}</h1>

        @if (errorMsg()) {
          <div class="error-toast">{{ errorMsg() }}</div>
        }

        <form #authForm="ngForm" (ngSubmit)="submit(authForm)">
          @if (mode() === 'register') {
            <label>
              Full Name
              <input
                [(ngModel)]="name"
                #nameCtrl="ngModel"
                name="name"
                required
                placeholder="Your name" />
              @if (nameCtrl.invalid && nameCtrl.touched) {
                <small class="field-err">Full Name is required.</small>
              }
            </label>
          }

          <label>
            Email
            <input
              [(ngModel)]="email"
              #emailCtrl="ngModel"
              name="email"
              type="email"
              email
              required
              placeholder="host@company.com" />
            @if (emailCtrl.invalid && emailCtrl.touched) {
              <small class="field-err">Enter a valid email address.</small>
            }
          </label>

          <label>
            Password
            <input
              [(ngModel)]="password"
              #passCtrl="ngModel"
              name="password"
              type="password"
              minlength="8"
              required
              placeholder="Min 8 characters" />
            @if (passCtrl.invalid && passCtrl.touched) {
              <small class="field-err">Password must be at least 8 characters.</small>
            }
          </label>

          <button type="submit" class="primary-btn" [disabled]="busy()">
            {{ busy() ? 'Working...' : (mode() === 'login' ? 'Sign In' : 'Register & Continue') }}
          </button>
        </form>

        <div class="auth-footer">
          <button type="button" class="link-btn" (click)="toggleMode()">
            {{ mode() === 'login' ? 'Need an account? Register' : 'Already registered? Sign in' }}
          </button>
          <a routerLink="/join">Joining as participant?</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-shell {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .auth-card {
      background: #ffffff;
      border-radius: 16px;
      padding: 2rem;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
    }
    h1 { margin: 0 0 1.5rem; font-size: 1.5rem; }
    form { display: flex; flex-direction: column; gap: 1rem; }
    label { display: flex; flex-direction: column; gap: 0.35rem; font-weight: 600; font-size: 0.9rem; }
    input { padding: 0.7rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; }
    .field-err { color: #b91c1c; font-weight: 500; font-size: 0.82rem; }
    .primary-btn {
      background: #0284c7;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 0.8rem;
      font-weight: 700;
      margin-top: 0.5rem;
    }
    .primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .auth-footer {
      margin-top: 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
    }
    .link-btn { background: none; border: none; color: #0284c7; padding: 0; font-weight: 600; }
    a { color: #475569; }
  `]
})
export class HostLoginComponent {
  private auth = inject(HostAuthService);
  private slido = inject(SlidoSocketService);
  private router = inject(Router);

  mode = signal<'login' | 'register'>('login');
  busy = signal(false);
  errorMsg = signal<string | null>(null);

  name = '';
  email = '';
  password = '';

  toggleMode(): void {
    this.errorMsg.set(null);
    this.mode.update((m) => (m === 'login' ? 'register' : 'login'));
  }

  async submit(form: NgForm): Promise<void> {
    if (form.invalid) {
      form.control.markAllAsTouched();
      this.errorMsg.set('Fix the highlighted fields before continuing.');
      return;
    }

    this.busy.set(true);
    this.errorMsg.set(null);
    try {
      if (this.mode() === 'register') {
        await this.auth.register(this.name.trim(), this.email.trim(), this.password);
      } else {
        await this.auth.login(this.email.trim(), this.password);
      }
      this.slido.refreshSocketAuth();
      await this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.errorMsg.set(err?.error?.error || 'Authentication failed');
    } finally {
      this.busy.set(false);
    }
  }
}
