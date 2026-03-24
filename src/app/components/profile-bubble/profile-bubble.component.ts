import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef,
  ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import JsBarcode from 'jsbarcode';
import { environment } from '../../../environments/environment';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-profile-bubble',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-bubble.component.html',
  styleUrl: './profile-bubble.component.css'
})
export class ProfileBubbleComponent implements OnInit {
  @ViewChild('barcodeEl') barcodeEl?: ElementRef<SVGSVGElement>;

  isOpen = false;
  customerName = '';
  customerPhone = '';
  customerCode = '';
  giftPoint = 0;

  // Change password
  showChangePassword = false;
  currentPassword = '';
  newPassword = '';
  showCurrentPw = false;
  showNewPw = false;
  cpwSubmitting = false;
  cpwError = '';
  cpwSuccess = '';

  get initial(): string {
    return this.customerName?.charAt(0)?.toUpperCase() || '?';
  }

  constructor(private cdr: ChangeDetectorRef, private http: HttpClient, private snackbar: SnackbarService) {}

  ngOnInit(): void {
    this.loadFromLocalStorage();
  }

  toggleModal(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.loadFromLocalStorage();
      this.fetchLatestProfile();
      setTimeout(() => this.renderBarcode(), 0);
    }
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.isOpen = false;
    this.cdr.markForCheck();
  }

  private loadFromLocalStorage(): void {
    this.customerName = localStorage.getItem('sm_customer_name') || '';
    this.customerPhone = localStorage.getItem('sm_customer_phone') || '';
    this.customerCode = localStorage.getItem('sm_customer_code') || localStorage.getItem('sm_customer_identity') || '';
    this.giftPoint = Number(localStorage.getItem('sm_customer_giftpoint')) || 0;
  }

  private fetchLatestProfile(): void {
    const identity = this.customerCode || this.customerPhone;
    if (!identity) return;

    this.http.post<any>(`${environment.domainUrl}/api/chat/verify-identity`, { identity }).subscribe({
      next: (res) => {
        if (res?.verified) {
          if (res.name) {
            this.customerName = res.name;
            localStorage.setItem('sm_customer_name', res.name);
          }
          if (res.phone) {
            this.customerPhone = res.phone;
            localStorage.setItem('sm_customer_phone', res.phone);
          }
          if (res.code) {
            this.customerCode = res.code;
            localStorage.setItem('sm_customer_code', res.code);
          }
          if (res.giftPoint != null) {
            this.giftPoint = res.giftPoint;
            localStorage.setItem('sm_customer_giftpoint', String(res.giftPoint));
          }
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        if (!(err instanceof HttpErrorResponse && err.status >= 500)) {
          this.snackbar.error('Không tải được thông tin tài khoản.');
        }
      }
    });
  }

  changePassword(): void {
    const pw = this.newPassword.trim();
    if (!pw || pw.length < 4 || this.cpwSubmitting) return;

    this.cpwSubmitting = true;
    this.cpwError = '';
    this.cpwSuccess = '';
    this.cdr.markForCheck();

    const identity = this.customerCode || this.customerPhone;
    const body: any = { identity, newPassword: pw };
    if (this.currentPassword.trim()) {
      body.currentPassword = this.currentPassword.trim();
    }

    this.http.post<any>(`${environment.domainUrl}/api/chat/change-password`, body).subscribe({
      next: (res) => {
        this.cpwSubmitting = false;
        if (res?.success) {
          this.cpwSuccess = 'Đổi mật khẩu thành công!';
          this.currentPassword = '';
          this.newPassword = '';
          setTimeout(() => {
            this.showChangePassword = false;
            this.cpwSuccess = '';
            this.cdr.markForCheck();
          }, 1500);
        } else {
          this.cpwError = res?.message || 'Lỗi đổi mật khẩu';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.cpwSubmitting = false;
        if (err instanceof HttpErrorResponse && err.status >= 500) {
          this.cpwError = 'Lỗi máy chủ. Vui lòng thử lại sau.';
        } else {
          this.cpwError = err?.error?.message || 'Lỗi kết nối';
          if (!err?.error?.message) {
            this.snackbar.error('Đổi mật khẩu thất bại. Kiểm tra kết nối mạng.');
          }
        }
        this.cdr.markForCheck();
      }
    });
  }

  cancelChangePassword(): void {
    this.showChangePassword = false;
    this.currentPassword = '';
    this.newPassword = '';
    this.cpwError = '';
    this.cpwSuccess = '';
    this.showCurrentPw = false;
    this.showNewPw = false;
    this.cdr.markForCheck();
  }

  private renderBarcode(): void {
    if (!this.barcodeEl?.nativeElement || !this.customerCode) return;
    try {
      JsBarcode(this.barcodeEl.nativeElement, this.customerCode, {
        format: 'CODE128',
        width: 1.5,
        height: 50,
        displayValue: true,
        fontSize: 14,
        margin: 5
      });
    } catch { /* ignore invalid barcode */ }
  }
}
