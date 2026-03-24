import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SnackbarService } from '../../services/snackbar.service';

const IDENTITY_KEY = 'sm_customer_identity';
const IDENTITY_NAME_KEY = 'sm_customer_name';
const IDENTITY_PHONE_KEY = 'sm_customer_phone';
const IDENTITY_CODE_KEY = 'sm_customer_code';
const GIFT_POINT_KEY = 'sm_customer_giftpoint';
const REGISTER_URL = 'https://songminhdangkythanhvien.onrender.com/';

interface VerifyResponse {
  verified: boolean;
  name?: string;
  identity?: string;
  phone?: string;
  code?: string;
  type?: string;
  message?: string;
  giftPoint?: number;
  hasPassword?: boolean;
  requirePassword?: boolean;
}

export interface IdentityConfirmedEvent {
  identity: string;
  hasPassword: boolean;
}

@Component({
  selector: 'app-customer-identity-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="identity-backdrop">
      <div class="identity-dialog">
        <div class="identity-header">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1976d2" stroke-width="2">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <h2>Chào mừng đến Song Minh!</h2>
        </div>

        <p class="identity-desc">Vui lòng nhập mã thành viên hoặc số điện thoại để tiếp tục</p>

        <input
          class="identity-input"
          [class.input-error]="errorMessage"
          [(ngModel)]="inputValue"
          placeholder="Mã thành viên / Số điện thoại"
          (keydown.enter)="passwordInput.focus()"
          (input)="errorMessage = ''"
          autofocus
        />

        <div class="password-section">
          <div class="password-input-wrap">
            <input
              #passwordInput
              class="identity-input"
              [(ngModel)]="passwordValue"
              [type]="showPassword ? 'text' : 'password'"
              placeholder="Mật khẩu"
              (keydown.enter)="onConfirm()"
              (input)="errorMessage = ''"
            />
            <button class="eye-btn" type="button" (click)="showPassword = !showPassword">
              <svg *ngIf="!showPassword" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <svg *ngIf="showPassword" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>
        </div>

        <p class="error-text" *ngIf="errorMessage">{{ errorMessage }}</p>

        <p class="identity-register-text">
          Nếu bạn chưa có mã thành viên, hãy nhấn vào
          <a class="register-link" (click)="onRegister()">Đăng ký</a>
        </p>

        <button class="identity-confirm-btn" [disabled]="!inputValue.trim() || isVerifying" (click)="onConfirm()">
          <span *ngIf="!isVerifying">Đăng nhập</span>
          <span *ngIf="isVerifying">Đang xác minh...</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .identity-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 16px;
    }
    .identity-dialog {
      background: #fff;
      border-radius: 16px;
      padding: 28px 24px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      text-align: center;
    }
    .identity-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .identity-header h2 {
      margin: 0;
      font-size: 18px;
      color: #1a1a1a;
      font-weight: 700;
    }
    .identity-desc {
      font-size: 13px;
      color: #666;
      margin: 0 0 16px;
    }
    .identity-input {
      width: 100%;
      padding: 12px 14px;
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      font-size: 15px;
      outline: none;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }
    .identity-input:focus {
      border-color: #1976d2;
    }
    .identity-input.input-error {
      border-color: #d32f2f;
    }
    .error-text {
      font-size: 13px;
      color: #d32f2f;
      margin: 8px 0 0;
      font-weight: 500;
    }
    .identity-register-text {
      font-size: 13px;
      color: #666;
      margin: 14px 0;
    }
    .register-link {
      color: #1976d2;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
    }
    .identity-confirm-btn {
      width: 100%;
      padding: 12px;
      background: #1976d2;
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .identity-confirm-btn:disabled {
      background: #b0bec5;
      cursor: not-allowed;
    }
    .identity-confirm-btn:not(:disabled):hover {
      background: #1565c0;
    }
    .password-section {
      margin-top: 10px;
    }
    .password-input-wrap {
      position: relative;
    }
    .password-input-wrap .identity-input {
      padding-right: 40px;
    }
    .eye-btn {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      opacity: 0.6;
    }
    .eye-btn:hover {
      opacity: 1;
    }
  `]
})
export class CustomerIdentityDialogComponent {
  @Output() confirmed = new EventEmitter<IdentityConfirmedEvent>();

  private http = inject(HttpClient);
  private snackbar = inject(SnackbarService);

  inputValue = '';
  passwordValue = '';
  errorMessage = '';
  isVerifying = false;
  showPassword = false;

  static getStoredIdentity(): string | null {
    return localStorage.getItem(IDENTITY_KEY);
  }

  static getStoredName(): string | null {
    return localStorage.getItem(IDENTITY_NAME_KEY);
  }

  async onConfirm(): Promise<void> {
    const val = this.inputValue.trim();
    if (!val || this.isVerifying) return;

    this.isVerifying = true;
    this.errorMessage = '';

    try {
      const body: any = { identity: val };
      // Always send password if provided
      if (this.passwordValue) {
        body.password = this.passwordValue;
      }

      const res = await firstValueFrom(this.http.post<VerifyResponse>(
        `${environment.domainUrl}/api/chat/verify-identity`,
        body
      ));

      if (res?.requirePassword) {
        // Customer has password but user didn't provide one
        this.errorMessage = 'Vui lòng nhập mật khẩu';
        this.isVerifying = false;
        return;
      }

      if (res?.verified) {
        localStorage.setItem(IDENTITY_KEY, res.identity || val);
        localStorage.setItem(IDENTITY_NAME_KEY, res.name || val);
        if (res.phone) {
          localStorage.setItem(IDENTITY_PHONE_KEY, res.phone);
        }
        if (res.code) {
          localStorage.setItem(IDENTITY_CODE_KEY, res.code);
        }
        localStorage.setItem(GIFT_POINT_KEY, String(res.giftPoint || 0));
        this.confirmed.emit({ identity: res.identity || val, hasPassword: res.hasPassword ?? false });
      } else {
        this.errorMessage = res?.message || 'Không tìm thấy khách hàng';
      }
    } catch (err: any) {
      if (err instanceof HttpErrorResponse && err.status >= 500) {
        this.errorMessage = 'Lỗi máy chủ. Vui lòng thử lại sau.';
      } else if (err instanceof HttpErrorResponse && err.status === 0) {
        this.errorMessage = 'Không thể kết nối máy chủ.';
        this.snackbar.error('Không thể kết nối máy chủ.');
      } else {
        const msg = err?.error?.message;
        this.errorMessage = msg || 'Không tìm thấy khách hàng với mã/SĐT này';
      }
    }

    this.isVerifying = false;
  }

  onRegister(): void {
    window.open(REGISTER_URL, '_blank');
  }
}
