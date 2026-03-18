import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef,
  ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import JsBarcode from 'jsbarcode';
import { WebSocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-profile-bubble',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-bubble.component.html',
  styleUrl: './profile-bubble.component.css'
})
export class ProfileBubbleComponent implements OnInit, OnDestroy {
  @ViewChild('barcodeEl') barcodeEl?: ElementRef<SVGSVGElement>;

  isOpen = false;
  customerName = '';
  customerPhone = '';
  customerCode = '';
  giftPoint = 0;

  private bonusSub?: Subscription;

  get initial(): string {
    return this.customerName?.charAt(0)?.toUpperCase() || '?';
  }

  constructor(private cdr: ChangeDetectorRef, private wsService: WebSocketService) {}

  ngOnInit(): void {
    this.customerName = localStorage.getItem('sm_customer_name') || '';
    this.customerPhone = localStorage.getItem('sm_customer_phone') || '';
    this.customerCode = localStorage.getItem('sm_customer_identity') || '';
    this.giftPoint = Number(localStorage.getItem('sm_customer_giftpoint')) || 0;

    this.bonusSub = this.wsService.getBonusUpdated$().subscribe(payload => {
      this.giftPoint = payload.giftPoint;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.bonusSub?.unsubscribe();
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
