import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef,
  ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import JsBarcode from 'jsbarcode';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile-bubble',
  standalone: true,
  imports: [CommonModule],
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

  get initial(): string {
    return this.customerName?.charAt(0)?.toUpperCase() || '?';
  }

  constructor(private cdr: ChangeDetectorRef, private http: HttpClient) {}

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
    this.customerCode = localStorage.getItem('sm_customer_identity') || '';
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
          if (res.giftPoint != null) {
            this.giftPoint = res.giftPoint;
            localStorage.setItem('sm_customer_giftpoint', String(res.giftPoint));
          }
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
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
