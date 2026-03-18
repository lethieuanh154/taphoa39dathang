import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef,
  ViewChild, ElementRef, AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import JsBarcode from 'jsbarcode';

@Component({
  selector: 'app-profile-bubble',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Bubble FAB -->
    <button class="profile-fab" (click)="toggleModal()">
      <span class="profile-initial">{{ initial }}</span>
    </button>

    <!-- Modal -->
    <div class="profile-backdrop" *ngIf="isOpen" (click)="closeModal()">
      <div class="profile-modal" (click)="$event.stopPropagation()">
        <!-- Close -->
        <button class="modal-close" (click)="closeModal()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <!-- Card content (same structure as SongMinhDangKyThanhVien card-page) -->
        <div class="card-capture">
          <div class="logo-section">
            <img src="assets/iconSongMinh.png" alt="Song Minh" class="logo-icon" />
            <h1>Song Minh</h1>
            <p class="subtitle">Thẻ thành viên</p>
          </div>

          <div class="member-card">
            <div class="success-badge">&#10004; Thành viên</div>

            <div class="customer-info">
              <p *ngIf="customerName"><strong>Họ tên:</strong> {{ customerName }}</p>
              <p><strong>SĐT:</strong> {{ customerPhone }}</p>
              <p><strong>Mã KH:</strong> {{ customerCode }}</p>
            </div>

            <div class="points-row">
              <span class="points-icon">&#11088;</span>
              <span class="points-label">Điểm thưởng:</span>
              <span class="points-value">{{ giftPoint | number:'1.0-0' }} điểm</span>
            </div>

            <div class="barcode-container" *ngIf="customerCode">
              <svg #barcodeEl></svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './profile-bubble.component.css'
})
export class ProfileBubbleComponent implements OnInit {
  @ViewChild('barcodeEl') barcodeEl?: ElementRef<SVGSVGElement>;

  isOpen = false;
  customerName = '';
  customerPhone = '';
  customerCode = '';
  giftPoint = 0;

  get initial(): string {
    return this.customerName?.charAt(0)?.toUpperCase() || '?';
  }

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.customerName = localStorage.getItem('sm_customer_name') || '';
    this.customerPhone = localStorage.getItem('sm_customer_phone') || '';
    this.customerCode = localStorage.getItem('sm_customer_identity') || '';
    this.giftPoint = Number(localStorage.getItem('sm_customer_giftpoint')) || 0;
  }

  toggleModal(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      // Refresh data
      this.customerName = localStorage.getItem('sm_customer_name') || '';
      this.customerPhone = localStorage.getItem('sm_customer_phone') || '';
      this.customerCode = localStorage.getItem('sm_customer_identity') || '';
      this.giftPoint = Number(localStorage.getItem('sm_customer_giftpoint')) || 0;
      this.cdr.markForCheck();

      // Render barcode after view updates
      setTimeout(() => this.renderBarcode(), 0);
    }
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.isOpen = false;
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
