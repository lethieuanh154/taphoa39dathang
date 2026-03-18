import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, switchMap, debounceTime, takeUntil, catchError, of, EMPTY } from 'rxjs';
import { CartService } from '../../services/cart.service';
import { OrderApiService } from '../../services/order-api.service';
import { ShippingService } from '../../services/shipping.service';
import { RewardService } from '../../services/reward.service';
import { CartItem, OrderData, FinalCalculation, ShipCostResult } from '../../models/product';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CheckoutComponent implements OnInit, OnDestroy {
  items: CartItem[] = [];
  customerName = '';
  customerPhone = '';
  customerAddress = '';
  note = '';
  paymentMethod: 'cod' | 'transfer' = 'cod';
  isSubmitting = false;
  errorMessage = '';

  // Shipping
  showShipRates = false;
  wantDelivery = false;
  isCalculatingShip = false;
  distanceKm = 0;
  durationMinutes = 0;
  shipResult: ShipCostResult = { shipCost: 0, freeKm: 0, ratePerKm: 0, canShip: true, message: '' };
  shipError = '';
  desiredDeliveryDate = '';
  desiredDeliveryTime = '';
  deliveryTimeError = '';
  estimatedStartTime = '';
  minDeliveryDate = '';

  // Reward points
  availablePoints = 0;
  usePointsForShip = false;
  usePointsForOrder = false;

  private addressSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private cartService: CartService,
    private orderApi: OrderApiService,
    private shippingService: ShippingService,
    private rewardService: RewardService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.items = this.cartService.getItems();
    if (this.items.length === 0) {
      this.router.navigate(['/']);
      return;
    }

    // Set min delivery date to today
    const today = new Date();
    this.minDeliveryDate = today.toISOString().split('T')[0];
    this.desiredDeliveryDate = this.minDeliveryDate;

    // Load saved customer info
    try {
      const saved = localStorage.getItem('sm_customer');
      if (saved) {
        const data = JSON.parse(saved);
        this.customerName = data.Name || '';
        this.customerPhone = data.ContactNumber || '';
        this.customerAddress = data.Address || '';
      }
    } catch {}
    if (!this.customerName) {
      this.customerName = localStorage.getItem('sm_customer_name') || '';
    }
    if (!this.customerPhone) {
      this.customerPhone = localStorage.getItem('sm_customer_phone') || '';
    }

    // Load reward points - fetch from API if not cached
    this.availablePoints = this.rewardService.getAvailablePoints();
    if (this.availablePoints === 0) {
      const identity = localStorage.getItem('sm_customer_identity') || localStorage.getItem('sm_customer_phone');
      if (identity) {
        this.http.post<any>(`${environment.domainUrl}/api/chat/verify-identity`, { identity }).subscribe({
          next: (res) => {
            if (res?.verified && res.giftPoint != null) {
              localStorage.setItem('sm_customer_giftpoint', String(res.giftPoint));
              this.availablePoints = res.giftPoint;
              this.cdr.markForCheck();
            }
          },
          error: () => {} // silent fail
        });
      }
    }

    // Setup address geocoding pipeline
    this.addressSubject.pipe(
      debounceTime(800),
      switchMap(address => {
        if (!address.trim()) return EMPTY;
        this.isCalculatingShip = true;
        this.shipError = '';
        this.cdr.markForCheck();
        return this.shippingService.geocodeAddress(address).pipe(
          switchMap(({ lat, lng }) => this.shippingService.calculateDistance(lat, lng)),
          catchError(err => {
            this.shipError = err?.message || 'Lỗi tính khoảng cách';
            this.isCalculatingShip = false;
            this.distanceKm = 0;
            this.shipResult = { shipCost: 0, freeKm: 0, ratePerKm: 0, canShip: true, message: '' };
            this.cdr.markForCheck();
            return EMPTY;
          })
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe(result => {
      this.distanceKm = result.distanceKm;
      this.durationMinutes = result.durationMinutes+5;
      this.shipResult = this.shippingService.calculateShipCost(this.orderSubtotal, this.distanceKm);
      this.isCalculatingShip = false;
      this.updateStartTime();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Getters ---

  get orderSubtotal(): number {
    return this.cartService.getTotalPrice();
  }

  get totalItems(): number {
    return this.cartService.getTotalItems();
  }

  get shipCost(): number {
    return this.wantDelivery && this.shipResult.canShip ? this.shipResult.shipCost : 0;
  }

  get calculation(): FinalCalculation {
    return this.rewardService.calculateFinal(
      this.orderSubtotal,
      this.shipCost,
      this.usePointsForShip,
      this.usePointsForOrder
    );
  }

  get isFormValid(): boolean {
    const baseValid = this.customerName.trim().length > 0
      && this.customerPhone.trim().length >= 9
      && this.items.length > 0;

    if (this.wantDelivery) {
      return baseValid
        && this.customerAddress.trim().length > 0
        && this.shipResult.canShip
        && !this.shipError
        && !this.deliveryTimeError
        && !this.isCalculatingShip
        && this.distanceKm > 0;
    }
    return baseValid;
  }

  // --- Actions ---

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN');
  }

  onDeliveryToggle(): void {
    if (!this.wantDelivery) {
      this.usePointsForShip = false;
      this.distanceKm = 0;
      this.shipResult = { shipCost: 0, freeKm: 0, ratePerKm: 0, canShip: true, message: '' };
      this.shipError = '';
      this.desiredDeliveryTime = '';
      this.estimatedStartTime = '';
    } else if (this.customerAddress.trim()) {
      this.isCalculatingShip = true;
      this.addressSubject.next(this.customerAddress);
    }
  }

  onAddressChange(): void {
    if (this.wantDelivery && this.customerAddress.trim()) {
      this.isCalculatingShip = true;
      this.addressSubject.next(this.customerAddress);
    }
  }

  onTimeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Only allow digits and colon
    let val = input.value.replace(/[^\d]/g, '');
    // Auto-insert colon after 2 digits
    if (val.length > 2) {
      val = val.slice(0, 2) + ':' + val.slice(2, 4);
    }
    // Clamp hours 0-23, minutes 0-59
    if (val.length >= 2) {
      const h = Math.min(23, parseInt(val.slice(0, 2), 10));
      val = h.toString().padStart(2, '0') + val.slice(2);
    }
    if (val.length === 5) {
      const m = Math.min(59, parseInt(val.slice(3, 5), 10));
      val = val.slice(0, 3) + m.toString().padStart(2, '0');
    }
    input.value = val;
    this.desiredDeliveryTime = val;
    if (val.length === 5) {
      this.onDesiredTimeChange();
    }
  }

  onDesiredTimeChange(): void {
    this.deliveryTimeError = '';
    if (this.desiredDeliveryTime) {
      const [h, m] = this.desiredDeliveryTime.split(':').map(Number);
      const minutes = h * 60 + m;
      if (minutes < 480 || minutes > 960) { // 8:00 = 480, 17:00 = 1020
        this.deliveryTimeError = 'Giờ giao hàng chỉ từ 8:00 đến 16:00. Vui lòng chọn lại.';
      }
    }
    this.updateStartTime();
  }

  onPointsForShipToggle(): void {
    if (!this.usePointsForShip) {
      // unchecked
    }
    this.cdr.markForCheck();
  }

  onPointsForOrderToggle(): void {
    this.cdr.markForCheck();
  }

  private updateStartTime(): void {
    this.estimatedStartTime = this.shippingService.calculateStartTime(
      this.desiredDeliveryTime,
      this.durationMinutes
    );
  }

  formatDeliveryDate(dateStr: string): string {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  getQrUrl(): string {
    const amount = this.calculation.finalTotal;
    const addInfo = encodeURIComponent('Song Minh DH ' + Date.now());
    return `https://img.vietqr.io/image/TPB-69586928888-qr_only.png?amount=${amount}&addInfo=${addInfo}`;
  }

  submitOrder(): void {
    if (!this.isFormValid || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    const now = new Date();
    const orderId = 'DH' + now.getTime().toString();
    const calc = this.calculation;

    const order: OrderData = {
      id: orderId,
      customer: {
        Name: this.customerName.trim(),
        ContactNumber: this.customerPhone.trim(),
        Address: this.customerAddress.trim()
      },
      cartItems: this.items.map(item => {
        const saleOff = item.unitPriceSaleOff || 0;
        const unitPrice = item.product.BasePrice - saleOff;
        return {
          product: { ...item.product },
          quantity: item.quantity,
          unitPriceSaleOff: saleOff,
          unitPrice,
          totalPrice: unitPrice * item.quantity
        };
      }),
      totalPrice: calc.finalTotal,
      totalQuantity: this.totalItems,
      discountAmount: calc.pointsUsedForOrder,
      customerPaid: this.paymentMethod === 'transfer' ? calc.finalTotal : 0,
      totalCost: this.items.reduce((sum, i) => sum + (i.product.Cost || 0) * i.quantity, 0),
      note: this.note.trim(),
      status: 'pending',
      createdDate: now.toISOString(),
      deliveryTime: '',
      source: 'online',
      paymentMethod: this.paymentMethod,
      wantDelivery: this.wantDelivery,
      shipCost: calc.shipCost,
      distanceKm: this.distanceKm,
      pointsUsedForShip: calc.pointsUsedForShip,
      pointsUsedForOrder: calc.pointsUsedForOrder,
      desiredDeliveryDate: this.desiredDeliveryDate,
      desiredDeliveryTime: this.desiredDeliveryTime,
      estimatedStartTime: this.estimatedStartTime
    };

    // Save customer info for next time
    try {
      localStorage.setItem('sm_customer', JSON.stringify(order.customer));
    } catch {}

    this.orderApi.submitOrder(order).subscribe({
      next: () => {
        // Update remaining points in localStorage after successful order
        if (calc.pointsUsedForShip > 0 || calc.pointsUsedForOrder > 0) {
          localStorage.setItem('sm_customer_giftpoint', String(calc.remainingPoints));
        }
        this.cartService.clearCart();
        this.router.navigate(['/confirm', orderId]);
      },
      error: (err) => {
        console.error('Order submission failed:', err);
        this.errorMessage = 'Không thể đặt hàng. Vui lòng thử lại sau.';
        this.isSubmitting = false;
        this.cdr.markForCheck();
      }
    });
  }

  trackByCartItem(_: number, item: CartItem): string {
    return item.product.Code;
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}
