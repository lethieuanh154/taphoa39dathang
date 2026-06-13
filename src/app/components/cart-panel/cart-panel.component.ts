import { Component, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, HostListener } from '@angular/core';
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
  private historyPushed = false;

  totalDiscount = 0;
  stockWarning = '';
  private stockWarningTimer: any;

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
        if (open && !this.isOpen) {
          history.pushState({ modal: 'cart-panel' }, '');
          this.historyPushed = true;
        } else if (!open && this.isOpen && this.historyPushed) {
          this.historyPushed = false;
        }
        this.isOpen = open;
        this.cdr.markForCheck();
      }),
      this.cartService.totalDiscount$.subscribe(d => {
        this.totalDiscount = d;
        this.cdr.markForCheck();
      }),
      this.cartService.stockWarning$.subscribe(msg => {
        this.showStockWarning(msg);
      })
    );
  }

  private showStockWarning(msg: string): void {
    clearTimeout(this.stockWarningTimer);
    this.stockWarning = msg;
    this.cdr.markForCheck();
    this.stockWarningTimer = setTimeout(() => {
      this.stockWarning = '';
      this.cdr.markForCheck();
    }, 3000);
  }

  @HostListener('window:popstate')
  onPopState(): void {
    if (this.isOpen) {
      this.historyPushed = false;
      this.cartService.closePanel();
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  get totalPrice(): number {
    return Math.ceil(this.cartService.getTotalPrice() / 1000) * 1000;
  }

  get totalItems(): number {
    return Math.floor(this.cartService.getTotalItems() * 10) / 10;
  }

  round1(val: number): number {
    return Math.floor(val * 10) / 10;
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

  onQtyInput(code: string, event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(val) && val >= 1) {
      this.cartService.updateQuantity(code, val);
    }
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

  goToMyOrders(): void {
    this.cartService.closePanel();
    this.router.navigate(['/don-hang-cua-toi']);
  }

  getItemStock(item: CartItem): number {
    const stock = this.cartService.getAvailableStock(item.product);
    return Math.floor(stock * 10) / 10;
  }

  isOverStock(item: CartItem): boolean {
    const stock = this.getItemStock(item);
    return stock > 0 && item.quantity >= stock;
  }

  trackByCartItem(_: number, item: CartItem): string {
    return item.product.Code;
  }
}
