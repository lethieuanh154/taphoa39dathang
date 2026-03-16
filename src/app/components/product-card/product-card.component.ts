import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../models/product';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCardComponent {
  @Input() product!: Product;
  @Output() cardClick = new EventEmitter<Product>();
  addedAnimation = false;

  constructor(private cartService: CartService, private cdr: ChangeDetectorRef) {}

  get isOutOfStock(): boolean {
    const totalStock = this.product.OnHand + (this.product.CloneOnHandNV || 0);
    return totalStock <= 0;
  }

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN');
  }

  onCardClick(): void {
    this.cardClick.emit(this.product);
  }

  addToCart(event: Event): void {
    event.stopPropagation();
    if (this.isOutOfStock) return;
    this.cartService.addToCart(this.product);
    this.addedAnimation = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.addedAnimation = false;
      this.cdr.markForCheck();
    }, 600);
  }
}
