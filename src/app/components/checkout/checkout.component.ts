import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { OrderApiService } from '../../services/order-api.service';
import { CartItem, OrderData } from '../../models/product';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CheckoutComponent implements OnInit {
  items: CartItem[] = [];
  customerName = '';
  customerPhone = '';
  customerAddress = '';
  note = '';
  paymentMethod: 'cod' | 'transfer' = 'cod';
  isSubmitting = false;
  errorMessage = '';
  constructor(
    private cartService: CartService,
    private orderApi: OrderApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.items = this.cartService.getItems();
    if (this.items.length === 0) {
      this.router.navigate(['/']);
    }
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
  }

  get totalPrice(): number {
    return this.cartService.getTotalPrice();
  }

  get totalItems(): number {
    return this.cartService.getTotalItems();
  }

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN');
  }

  get isFormValid(): boolean {
    return this.customerName.trim().length > 0
      && this.customerPhone.trim().length >= 9
      && this.customerAddress.trim().length > 0
      && this.items.length > 0;
  }

  getQrUrl(): string {
    const amount = this.totalPrice;
    const addInfo = encodeURIComponent('Song Minh DH ' + Date.now());
    return `https://img.vietqr.io/image/TCB-9905084032-qr_only.png?amount=${amount}&addInfo=${addInfo}`;
  }

  submitOrder(): void {
    if (!this.isFormValid || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    const now = new Date();
    const orderId = 'DH' + now.getTime().toString();

    const order: OrderData = {
      id: orderId,
      customer: {
        Name: this.customerName.trim(),
        ContactNumber: this.customerPhone.trim(),
        Address: this.customerAddress.trim()
      },
      cartItems: this.items.map(item => ({
        product: {
          ...item.product,
          // Ensure only needed fields are sent
        },
        quantity: item.quantity,
        unitPriceSaleOff: item.unitPriceSaleOff || 0
      })),
      totalPrice: this.totalPrice,
      totalQuantity: this.totalItems,
      discountAmount: 0,
      customerPaid: this.paymentMethod === 'transfer' ? this.totalPrice : 0,
      totalCost: this.items.reduce((sum, i) => sum + (i.product.Cost || 0) * i.quantity, 0),
      note: this.note.trim(),
      status: 'pending',
      createdDate: now.toISOString(),
      deliveryTime: '',
      source: 'online',
      paymentMethod: this.paymentMethod
    };

    // Save customer info for next time
    try {
      localStorage.setItem('sm_customer', JSON.stringify(order.customer));
    } catch {}

    this.orderApi.submitOrder(order).subscribe({
      next: () => {
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
