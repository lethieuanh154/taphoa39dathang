import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PolicyFooterComponent } from '../policy-footer/policy-footer.component';
import { DeliveryTrackingService, DeliveryTrackingDoc } from '../../services/delivery-tracking.service';
import { TrackingMapComponent } from './tracking-map.component';

interface StatusStep {
  key: string;
  label: string;
  icon: string;
}

const STATUS_STEPS: StatusStep[] = [
  { key: 'pending', label: 'Chờ xử lý', icon: '📋' },
  { key: 'picking', label: 'Đang chuẩn bị', icon: '📦' },
  { key: 'in_transit', label: 'Đang giao hàng', icon: '🛵' },
  { key: 'arrived', label: 'Đã đến nơi', icon: '📍' },
  { key: 'delivered', label: 'Đã giao', icon: '✅' }
];

@Component({
  selector: 'app-order-confirm',
  standalone: true,
  imports: [CommonModule, PolicyFooterComponent, TrackingMapComponent],
  templateUrl: './order-confirm.component.html',
  styleUrls: ['./order-confirm.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderConfirmComponent implements OnInit, OnDestroy {
  orderId = '';
  tracking: DeliveryTrackingDoc | null = null;
  statusSteps = STATUS_STEPS;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private trackingService: DeliveryTrackingService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.orderId = this.route.snapshot.paramMap.get('orderId') || '';
    if (this.orderId) {
      this.trackingService.listenToTracking(this.orderId)
        .pipe(takeUntil(this.destroy$))
        .subscribe(doc => {
          this.tracking = doc;
          this.cdr.markForCheck();
        });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.trackingService.disconnect();
  }

  get currentStepIndex(): number {
    if (!this.tracking) return 0;
    const s = this.tracking.status;
    // Map 'picked' to same step as 'picking'
    const mapped = s === 'picked' ? 'picking' : s;
    const idx = this.statusSteps.findIndex(step => step.key === mapped);
    return idx >= 0 ? idx : 0;
  }

  get hasTracking(): boolean {
    return this.tracking != null;
  }

  goToTracking(): void {
    this.router.navigate(['/tracking', this.orderId]);
  }

  goToHistory(): void {
    this.router.navigate(['/don-hang-cua-toi']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
