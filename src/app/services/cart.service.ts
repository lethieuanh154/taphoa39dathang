import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Product, CartItem, AppliedPromotion } from '../models/product';
import { PromotionService } from './promotion.service';
import { ProductApiService } from './product-api.service';

@Injectable({ providedIn: 'root' })
export class CartService {
  private items: CartItem[] = [];
  private cartSubject = new BehaviorSubject<CartItem[]>([]);
  cart$ = this.cartSubject.asObservable();

  private panelOpenSubject = new BehaviorSubject<boolean>(false);
  panelOpen$ = this.panelOpenSubject.asObservable();

  // Promotion state
  private appliedPromotions: AppliedPromotion[] = [];
  private totalDiscount = 0;
  private promoRecalcSubject = new Subject<void>();

  private appliedPromotionsSubject = new BehaviorSubject<AppliedPromotion[]>([]);
  appliedPromotions$ = this.appliedPromotionsSubject.asObservable();

  private totalDiscountSubject = new BehaviorSubject<number>(0);
  totalDiscount$ = this.totalDiscountSubject.asObservable();

  constructor(private promotionService: PromotionService, private productApiService: ProductApiService) {
    this.loadFromStorage();

    // Debounce promotion recalculation (300ms)
    this.promoRecalcSubject.pipe(debounceTime(300)).subscribe(() => {
      this.doRecalculatePromotions();
    });
  }

  getItems(): CartItem[] {
    return [...this.items];
  }

  getNonGiftItems(): CartItem[] {
    return this.items.filter(i => !i.isGift);
  }

  getGiftItems(): CartItem[] {
    return this.items.filter(i => i.isGift);
  }

  getTotalItems(): number {
    return this.items.filter(i => !i.isGift).reduce((sum, item) => sum + item.quantity, 0);
  }

  getTotalPrice(): number {
    return this.items.reduce((sum, item) => {
      if (item.isGift) return sum; // Gift items are free
      const price = item.product.BasePrice - (item.unitPriceSaleOff || 0);
      return sum + price * item.quantity;
    }, 0);
  }

  getSubtotalBeforeDiscount(): number {
    return this.items
      .filter(i => !i.isGift)
      .reduce((sum, item) => sum + item.product.BasePrice * item.quantity, 0);
  }

  getTotalDiscount(): number {
    return this.totalDiscount;
  }

  getAppliedPromotions(): AppliedPromotion[] {
    return this.appliedPromotions;
  }

  addToCart(product: Product, quantity = 1): void {
    const idx = this.items.findIndex(i => i.product.Code === product.Code && !i.isGift);
    if (idx >= 0) {
      this.items = this.items.map((item, i) =>
        i === idx ? { ...item, quantity: item.quantity + quantity } : item
      );
    } else {
      this.items = [...this.items, { product, quantity, unitPriceSaleOff: 0 }];
    }
    this.emit();
    this.recalculatePromotions();
  }

  updateQuantity(code: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(code);
      return;
    }
    // Don't allow editing gift item quantity
    const item = this.items.find(i => i.product.Code === code);
    if (item?.isGift) return;

    this.items = this.items.map(item =>
      item.product.Code === code && !item.isGift ? { ...item, quantity } : item
    );
    this.emit();
    this.recalculatePromotions();
  }

  removeFromCart(code: string): void {
    // Don't allow removing gift items directly
    const item = this.items.find(i => i.product.Code === code);
    if (item?.isGift) return;

    this.items = this.items.filter(i => i.product.Code !== code);
    this.emit();
    this.recalculatePromotions();
  }

  clearCart(): void {
    this.items = [];
    this.appliedPromotions = [];
    this.totalDiscount = 0;
    this.appliedPromotionsSubject.next([]);
    this.totalDiscountSubject.next(0);
    this.emit();
  }

  togglePanel(): void {
    this.panelOpenSubject.next(!this.panelOpenSubject.value);
  }

  closePanel(): void {
    this.panelOpenSubject.next(false);
  }

  openPanel(): void {
    this.panelOpenSubject.next(true);
  }

  // Trigger debounced promotion recalculation
  recalculatePromotions(): void {
    this.promoRecalcSubject.next();
  }

  private async doRecalculatePromotions(): Promise<void> {
    const nonGiftItems = this.items.filter(i => !i.isGift);
    if (nonGiftItems.length === 0) {
      // Clear all promotions
      this.items = nonGiftItems;
      this.appliedPromotions = [];
      this.totalDiscount = 0;
      this.appliedPromotionsSubject.next([]);
      this.totalDiscountSubject.next(0);
      this.emit();
      return;
    }

    try {
      const result = await this.promotionService.applyPromotionsToCart(nonGiftItems);

      // Remove old gift items and reset discounts
      this.items = nonGiftItems.map(item => ({
        ...item,
        unitPriceSaleOff: 0
      }));

      // Look up cached products for extra info (Image, Unit, FullName)
      const allProducts = await this.productApiService.getAllRawCachedProducts();

      // Add gift items
      for (const gift of result.giftItems) {
        const realProduct = allProducts.find(p => p.Code === gift.code);
        this.items.push({
          product: {
            Id: Number(gift.productId),
            Code: gift.code,
            Name: realProduct?.Name || gift.name,
            FullName: realProduct?.FullName || gift.name,
            Image: realProduct?.Image || null,
            BasePrice: gift.basePrice || realProduct?.BasePrice || 0,
            Cost: 0,
            OnHand: 0,
            Unit: realProduct?.Unit || '',
            Description: '',
            CategoryId: null,
            ConversionValue: 1,
            MasterUnitId: null,
            MasterProductId: null,
            NormalizedName: '',
            NormalizedCode: '',
            isActive: true,
            isDeleted: false,
            ModifiedDate: '',
          },
          quantity: gift.quantity,
          unitPriceSaleOff: 0,
          isGift: true,
          promotionId: gift.promotionId
        });
      }

      // Apply discounts to items
      for (const applied of result.appliedPromotions) {
        if (applied.type === 'gift' || applied.discountAmount <= 0) continue;
        const idx = this.items.findIndex(
          i => String(i.product.Id) === applied.targetProductId && !i.isGift
        );
        if (idx >= 0) {
          const item = this.items[idx];
          this.items[idx] = {
            ...item,
            unitPriceSaleOff: Math.round(applied.discountAmount / item.quantity)
          };
        }
      }

      this.appliedPromotions = result.appliedPromotions;
      this.totalDiscount = result.totalDiscount;
      this.appliedPromotionsSubject.next(this.appliedPromotions);
      this.totalDiscountSubject.next(this.totalDiscount);
      this.emit();
    } catch (err) {
      console.error('Promotion recalculation failed:', err);
    }
  }

  private emit(): void {
    this.cartSubject.next([...this.items]);
    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('sm_cart', JSON.stringify(this.items));
    } catch {}
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('sm_cart');
      if (data) {
        this.items = JSON.parse(data);
        this.cartSubject.next([...this.items]);
        // Recalculate promotions on load (promotions may have changed)
        this.recalculatePromotions();
      }
    } catch {}
  }
}
