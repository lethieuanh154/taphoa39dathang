import { Component, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { SnackbarService, SnackbarMessage } from '../../services/snackbar.service';

@Component({
  selector: 'app-snackbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="snackbar-global"
      role="alert"
      [class.snackbar-show]="visible"
      (click)="dismiss()"
      [class.snackbar-error]="current?.type === 'error'"
      [class.snackbar-warning]="current?.type === 'warning'"
      [class.snackbar-success]="current?.type === 'success'"
    >
      <svg *ngIf="current?.type === 'error'" class="snackbar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <svg *ngIf="current?.type === 'warning'" class="snackbar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <svg *ngIf="current?.type === 'success'" class="snackbar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <span class="snackbar-text">{{ current?.text }}</span>
    </div>
  `,
  styles: [`
    .snackbar-global {
      position: fixed;
      /* Nam tren thanh dieu huong cua may (safe-area), khong bi che */
      bottom: calc(16px + env(safe-area-inset-bottom, 0px));
      left: 50%;
      /* An bang transform, KHONG bang bottom am: hop cao bao nhieu cung ra khoi man hinh */
      transform: translate(-50%, calc(100% + 32px + env(safe-area-inset-bottom, 0px)));
      opacity: 0;
      visibility: hidden;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      z-index: 99999;
      transition: transform 0.3s ease, opacity 0.3s ease, visibility 0.3s;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      width: calc(100vw - 32px);
      max-width: 520px;
      box-sizing: border-box;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      pointer-events: none;
      cursor: pointer;
    }
    .snackbar-show {
      transform: translate(-50%, 0);
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }
    @media (prefers-reduced-motion: reduce) {
      .snackbar-global { transition: opacity 0.15s ease, visibility 0.15s; }
    }
    .snackbar-error {
      background: #d32f2f;
      color: #fff;
    }
    .snackbar-warning {
      background: #f57c00;
      color: #fff;
    }
    .snackbar-success {
      background: #2e7d32;
      color: #fff;
    }
    .snackbar-icon {
      flex-shrink: 0;
      margin-top: 2px;
    }
    .snackbar-text {
      line-height: 1.45;
      text-align: left;
      /* Message dai van doc duoc, khong tran ra ngoai */
      overflow-wrap: anywhere;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SnackbarComponent implements OnDestroy {
  visible = false;
  current: SnackbarMessage | null = null;
  private timer: any;
  private sub: Subscription;

  constructor(private snackbar: SnackbarService, private cdr: ChangeDetectorRef) {
    this.sub = this.snackbar.getMessage$().subscribe(msg => {
      clearTimeout(this.timer);
      this.current = msg;
      this.visible = true;
      this.cdr.markForCheck();
      // Message cang dai cang can nhieu thoi gian doc (~55ms/ky tu), toi da 12s
      const readMs = Math.min(12000, Math.max(3000, (msg.text || '').length * 55));
      this.timer = setTimeout(() => {
        this.visible = false;
        this.cdr.markForCheck();
      }, msg.duration || readMs);
    });
  }

  /** Cham vao de tat som, khong phai cho het gio. */
  dismiss(): void {
    clearTimeout(this.timer);
    this.visible = false;
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    this.sub.unsubscribe();
  }
}
