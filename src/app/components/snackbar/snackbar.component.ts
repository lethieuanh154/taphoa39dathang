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
      [class.snackbar-show]="visible"
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
      bottom: -60px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 20px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      z-index: 99999;
      transition: bottom 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: 90vw;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      pointer-events: none;
    }
    .snackbar-show {
      bottom: 24px;
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
    }
    .snackbar-text {
      line-height: 1.4;
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
      this.timer = setTimeout(() => {
        this.visible = false;
        this.cdr.markForCheck();
      }, msg.duration || 3000);
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    this.sub.unsubscribe();
  }
}
