import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../models/product';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailComponent {
  @Input() product!: Product;
  @Input() group: Product[] = [];
  @Output() close = new EventEmitter<void>();

  selectedProduct!: Product;
  addedAnimation = false;

  constructor(private cartService: CartService, private cdr: ChangeDetectorRef) {}

  ngOnChanges(): void {
    this.selectedProduct = this.product;
  }

  get marketPrice(): number {
    return Math.round(this.selectedProduct.BasePrice * 1.10);
  }

  get originalPrice(): number {
    return Math.round(this.selectedProduct.BasePrice * 1.05);
  }

  get salePrice(): number {
    return this.selectedProduct.BasePrice;
  }

  get isOutOfStock(): boolean {
    return this.selectedProduct.OnHand <= 0;
  }

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN');
  }

  selectUnit(product: Product): void {
    this.selectedProduct = product;
    this.cdr.markForCheck();
  }

  addToCart(): void {
    if (this.isOutOfStock) return;
    this.cartService.addToCart(this.selectedProduct);
    this.addedAnimation = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.addedAnimation = false;
      this.cdr.markForCheck();
    }, 600);
  }

  onBackdropClick(): void {
    this.close.emit();
  }

  onDialogClick(event: Event): void {
    event.stopPropagation();
  }
}
