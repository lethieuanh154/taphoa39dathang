import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Product } from '../../models/product';
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
  @Output() close = new EventEmitter<void>();

  selectedProduct!: Product;
  addedAnimation = false;

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

  // get originalPrice(): number {
  //   return Math.round(this.selectedProduct.BasePrice * 1.05);
  // }

  get salePrice(): number {
    return this.selectedProduct.BasePrice;
  }

  get isOutOfStock(): boolean {
    const totalStock = this.selectedProduct.OnHand + (this.selectedProduct.CloneOnHandNV || 0);
    return totalStock <= 0;
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
