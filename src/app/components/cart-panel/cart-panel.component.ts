import { Component, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartService } from '../../services/cart.service';
import { CartItem } from '../../models/product';

@Component({
  selector: 'app-cart-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart-panel.component.html',
  styleUrls: ['./cart-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartPanelComponent implements OnDestroy {
  items: CartItem[] = [];
  isOpen = false;
  private subs: Subscription[] = [];

  totalDiscount = 0;

  constructor(
    private cartService: CartService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.subs.push(
      this.cartService.cart$.subscribe(items => {
        this.items = items;
        this.cdr.markForCheck();
      }),
      this.cartService.panelOpen$.subscribe(open => {
        this.isOpen = open;
        this.cdr.markForCheck();
      }),
      this.cartService.totalDiscount$.subscribe(d => {
        this.totalDiscount = d;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
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

  increase(code: string): void {
    const item = this.items.find(i => i.product.Code === code);
    if (item) this.cartService.updateQuantity(code, item.quantity + 1);
  }

  decrease(code: string): void {
    const item = this.items.find(i => i.product.Code === code);
    if (item) this.cartService.updateQuantity(code, item.quantity - 1);
  }

  remove(code: string): void {
    this.cartService.removeFromCart(code);
  }

  close(): void {
    this.cartService.closePanel();
  }

  goToCheckout(): void {
    this.cartService.closePanel();
    this.router.navigate(['/checkout']);
  }

  trackByCartItem(_: number, item: CartItem): string {
    return item.product.Code;
  }
}
