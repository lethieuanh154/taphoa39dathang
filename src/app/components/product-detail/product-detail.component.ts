import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Product, Promotion } from '../../models/product';
import { CartService } from '../../services/cart.service';
import { environment } from '../../../environments/environment';

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
  @Input() isSale = false;
  @Input() promotion: Promotion | null = null;
  @Output() close = new EventEmitter<void>();

  selectedProduct!: Product;
  addedAnimation = false;
  quantity = 1;

  // Snackbar
  snackbarVisible = false;
  snackbarMessage = '';
  private snackbarTimer: any;

  // Image gallery
  productImages: string[] = [];
  currentImageIndex = 0;
  imagesLoaded = false;

  constructor(
    private cartService: CartService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {}

  ngOnChanges(): void {
    this.selectedProduct = this.product;
    this.quantity = 1;
    this.currentImageIndex = 0;
    this.productImages = [];
    this.imagesLoaded = false;
    this.loadProductImages();
  }

  private loadProductImages(): void {
    if (!this.selectedProduct?.Id) return;
    const url = `${environment.domainUrl}/api/kiotviet/product-images/${this.selectedProduct.Id}`;
    this.http.get<{ images: string[]; total: number }>(url).subscribe({
      next: (res) => {
        if (res.images?.length > 1) {
          this.productImages = res.images;
        } else {
          this.productImages = [];
        }
        this.imagesLoaded = true;
        this.currentImageIndex = 0;
        this.cdr.markForCheck();
      },
      error: () => {
        this.productImages = [];
        this.imagesLoaded = true;
        this.cdr.markForCheck();
      }
    });
  }

  get currentImage(): string {
    if (this.productImages.length > 0) {
      return this.productImages[this.currentImageIndex];
    }
    return this.selectedProduct.Image || 'assets/no-image.svg';
  }

  selectImage(index: number): void {
    this.currentImageIndex = index;
    this.cdr.markForCheck();
  }

  prevImage(): void {
    if (this.productImages.length === 0) return;
    this.currentImageIndex = (this.currentImageIndex - 1 + this.productImages.length) % this.productImages.length;
    this.cdr.markForCheck();
  }

  nextImage(): void {
    if (this.productImages.length === 0) return;
    this.currentImageIndex = (this.currentImageIndex + 1) % this.productImages.length;
    this.cdr.markForCheck();
  }

  get marketPrice(): number {
    return Math.round((this.selectedProduct.BasePrice * 1.10)/500)*500;
  }

  get originalPrice(): number {
    return Math.round((this.selectedProduct.BasePrice * 1.05)/500)*500;
  }

  get salePrice(): number {
    return this.selectedProduct.BasePrice;
  }

  /** Total stock across all group variants, converted to master unit */
  get totalMasterStock(): number {
    return this.group.reduce((sum, p) => {
      const stock = p.OnHand + (p.CloneOnHandNV || 0);
      return sum + stock * (p.ConversionValue || 1);
    }, 0);
  }

  /** Stock as percentage of the largest ConversionValue in the group */
  get stockPercent(): number {
    const maxCV = Math.max(...this.group.map(p => p.ConversionValue || 1));
    if (maxCV <= 0) return this.totalMasterStock > 0 ? 100 : 0;
    return (this.totalMasterStock / maxCV) * 100;
  }

  get stockStatus(): 'in-stock' | 'low-stock' | 'very-low' | 'out-of-stock' {
    const pct = this.stockPercent;
    if (pct <= 0) return 'out-of-stock';
    if (pct < 3) return 'very-low';
    if (pct <= 10) return 'low-stock';
    return 'in-stock';
  }

  get stockLabel(): string {
    switch (this.stockStatus) {
      case 'in-stock': return 'Còn hàng';
      case 'low-stock': return 'Sắp hết hàng';
      case 'very-low': return 'Chỉ còn vài sản phẩm';
      case 'out-of-stock': return 'Hết hàng';
    }
  }

  get isOutOfStock(): boolean {
    return this.stockStatus === 'out-of-stock';
  }

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN');
  }

  selectUnit(product: Product): void {
    this.selectedProduct = product;
    this.currentImageIndex = 0;
    this.productImages = [];
    this.imagesLoaded = false;
    this.loadProductImages();
    this.cdr.markForCheck();
  }

  increaseQuantity(): void {
    this.quantity++;
    this.cdr.markForCheck();
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
      this.cdr.markForCheck();
    }
  }

  addToCart(): void {
    if (this.isOutOfStock) return;
    this.cartService.addToCart(this.selectedProduct, this.quantity);
    this.showSnackbar(`Đã thêm ${this.selectedProduct.FullName} vào giỏ hàng`);
    this.quantity = 1;
    this.addedAnimation = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.addedAnimation = false;
      this.cdr.markForCheck();
    }, 600);
  }

  private showSnackbar(message: string): void {
    clearTimeout(this.snackbarTimer);
    this.snackbarMessage = message;
    this.snackbarVisible = true;
    this.cdr.markForCheck();
    this.snackbarTimer = setTimeout(() => {
      this.snackbarVisible = false;
      this.cdr.markForCheck();
    }, 2500);
  }

  // Promotion helpers
  get hasGift(): boolean {
    if (!this.promotion) return false;
    return this.promotion.hasGift ?? this.promotion.type === 'gift';
  }

  get hasPercentDiscount(): boolean {
    if (!this.promotion) return false;
    return this.promotion.hasPercentDiscount ?? this.promotion.type === 'percentage';
  }

  get hasFixedDiscount(): boolean {
    if (!this.promotion) return false;
    return this.promotion.hasFixedDiscount ?? this.promotion.type === 'fixed_amount';
  }

  get hasAnyDiscount(): boolean {
    return this.hasPercentDiscount || this.hasFixedDiscount;
  }

  get promotionBadge(): string {
    if (!this.promotion) return '';
    const parts: string[] = [];
    if (this.hasGift) parts.push('TẶNG');
    if (this.hasPercentDiscount) parts.push(`-${this.promotion.discountPercent}%`);
    if (this.hasFixedDiscount) {
      const amt = this.promotion.discountAmount || 0;
      parts.push(amt >= 1000 ? `-${Math.round(amt / 1000)}K` : `-${amt}đ`);
    }
    return parts.join(' + ') || '';
  }

  get promotionDetail(): string {
    if (!this.promotion) return '';
    const parts: string[] = [];
    if (this.hasGift && this.promotion.giftProductName) {
      const qty = this.promotion.giftQuantity || 1;
      parts.push(`Tặng ${qty > 1 ? qty + ' ' : ''}${this.promotion.giftProductName}`);
    }
    if (this.hasPercentDiscount && this.promotion.discountPercent) {
      parts.push(`Giảm ${this.promotion.discountPercent}%`);
    }
    if (this.hasFixedDiscount && this.promotion.discountAmount) {
      parts.push(`Giảm ${this.promotion.discountAmount.toLocaleString('vi-VN')}đ`);
    }
    return parts.join(' + ') || '';
  }

  get discountedPrice(): number {
    if (!this.promotion) return this.selectedProduct.BasePrice;
    let price = this.selectedProduct.BasePrice;
    if (this.hasPercentDiscount && this.promotion.discountPercent) {
      price = Math.round(price * (1 - this.promotion.discountPercent / 100));
    }
    if (this.hasFixedDiscount && this.promotion.discountAmount) {
      price = Math.max(0, price - this.promotion.discountAmount);
    }
    return price;
  }

  get promotionCondition(): string {
    if (!this.promotion) return '';
    const min = this.promotion.minQuantity || 1;
    return min > 1 ? `Mua từ ${min} sản phẩm` : '';
  }

  onBackdropClick(): void {
    this.close.emit();
  }

  onDialogClick(event: Event): void {
    event.stopPropagation();
  }
}
