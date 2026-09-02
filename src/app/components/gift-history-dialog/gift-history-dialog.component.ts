import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

const IDENTITY_CODE_KEY = 'sm_customer_code';
const IDENTITY_PHONE_KEY = 'sm_customer_phone';
const IDENTITY_KEY = 'sm_customer_identity';
const TOKEN_KEY = 'sm_customer_token';

interface GiftNote {
  id: string;
  text: string;
  createdAt: string;
}

@Component({
  selector: 'app-gift-history-dialog',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gift-backdrop" (click)="close()">
      <div class="gift-dialog" (click)="$event.stopPropagation()">
        <div class="gift-header">
          <h2>Lịch sử tặng quà</h2>
          <button class="gift-close" (click)="close()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="gift-body">
          <p class="gift-status" *ngIf="isLoading">Đang tải...</p>

          <p class="gift-status gift-error" *ngIf="!isLoading && errorMessage">{{ errorMessage }}</p>

          <p class="gift-status" *ngIf="!isLoading && !errorMessage && notes.length === 0">
            Bạn chưa có lịch sử tặng quà.
          </p>

          <ul class="gift-list" *ngIf="!isLoading && !errorMessage && notes.length > 0">
            <li class="gift-item" *ngFor="let note of notes">
              <span class="gift-icon">&#127873;</span>
              <div class="gift-content">
                <p class="gift-text">{{ note.text }}</p>
                <span class="gift-date">{{ note.createdAt | date:'dd/MM/yyyy' }}</span>
              </div>
            </li>
          </ul>
        </div>

        <button class="gift-ok-btn" (click)="close()">Đóng</button>
      </div>
    </div>
  `,
  styles: [`
    .gift-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 16px;
    }
    .gift-dialog {
      background: #fff;
      border-radius: 16px;
      padding: 20px;
      max-width: 420px;
      width: 100%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    }
    .gift-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .gift-header h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #1a1a1a;
    }
    .gift-close {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: #666;
      display: flex;
    }
    .gift-body {
      flex: 1;
      overflow-y: auto;
      min-height: 80px;
    }
    .gift-status {
      margin: 24px 0;
      text-align: center;
      font-size: 15px;
      color: #666;
    }
    .gift-status.gift-error {
      color: #d32f2f;
    }
    .gift-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .gift-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px;
      background: #fff8f0;
      border-left: 4px solid #F57C00;
      border-radius: 10px;
    }
    .gift-icon {
      font-size: 20px;
      line-height: 1.2;
    }
    .gift-content {
      flex: 1;
    }
    .gift-text {
      margin: 0 0 4px;
      font-size: 16px;
      color: #212121;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .gift-date {
      font-size: 13px;
      color: #888;
    }
    .gift-ok-btn {
      margin-top: 14px;
      width: 100%;
      min-height: 48px;
      background: #2E7D32;
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
    .gift-ok-btn:hover {
      background: #256628;
    }
  `]
})
export class GiftHistoryDialogComponent implements OnInit {
  @Output() closed = new EventEmitter<void>();

  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  notes: GiftNote[] = [];
  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    void this.load();
  }

  close(): void {
    this.closed.emit();
  }

  private get identity(): string {
    return localStorage.getItem(IDENTITY_CODE_KEY)
      || localStorage.getItem(IDENTITY_PHONE_KEY)
      || localStorage.getItem(IDENTITY_KEY)
      || '';
  }

  private async load(): Promise<void> {
    const identity = this.identity;
    if (!identity) {
      this.isLoading = false;
      this.errorMessage = 'Vui lòng đăng nhập để xem lịch sử tặng quà.';
      this.cdr.markForCheck();
      return;
    }

    try {
      this.notes = await this.fetchNotes(identity);
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        // Token het han / chua co -> xin token moi bang verify-identity (khach co mat khau se that bai)
        const refreshed = await this.refreshToken(identity);
        if (refreshed) {
          try {
            this.notes = await this.fetchNotes(identity);
            this.isLoading = false;
            this.cdr.markForCheck();
            return;
          } catch {
            this.errorMessage = 'Vui lòng đăng nhập lại để xem lịch sử tặng quà.';
          }
        } else {
          this.errorMessage = 'Vui lòng đăng nhập lại để xem lịch sử tặng quà.';
        }
      } else if (err instanceof HttpErrorResponse && err.status === 404) {
        this.notes = [];
      } else {
        this.errorMessage = 'Không tải được lịch sử tặng quà.';
      }
    }

    this.isLoading = false;
    this.cdr.markForCheck();
  }

  private async fetchNotes(identity: string): Promise<GiftNote[]> {
    const res = await firstValueFrom(this.http.post<{ notes: GiftNote[] }>(
      `${environment.domainUrl}/api/chat/customer-notes`,
      { identity, token: localStorage.getItem(TOKEN_KEY) || '' }
    ));
    return res?.notes || [];
  }

  private async refreshToken(identity: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(this.http.post<{ verified?: boolean; token?: string }>(
        `${environment.domainUrl}/api/chat/verify-identity`,
        { identity }
      ));
      if (res?.verified && res.token) {
        localStorage.setItem(TOKEN_KEY, res.token);
        return true;
      }
    } catch {
      // khach co mat khau -> requirePassword, phai dang nhap lai
    }
    return false;
  }
}
