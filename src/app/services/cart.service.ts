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

  // Stock warning
  private stockWarningSubject = new Subject<string>();
  stockWarning$ = this.stockWarningSubject.asObservable();

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

  /** Chỉ đếm real items (không phải gift/promo) */
  getTotalItems(): number {
    return this.items.filter(i => !i.isGift && !i.isPromotionItem).reduce((sum, item) => sum + item.quantity, 0);
  }

  getTotalPrice(): number {
    return this.items.reduce((sum, item) => {
      if (item.isGift) return sum; // Gift = free
      if (item.isPromotionItem) {
        // Type 3: discounted item — use calculated unitPrice or totalPrice
        return sum + (item.totalPrice ?? ((item.product.BasePrice - (item.unitPriceSaleOff || 0)) * item.quantity));
      }
      // Normal + Type 2 direct discount
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

  getAvailableStock(product: Product): number {
    return product.OnHand + (product.CloneOnHandNV || 0);
  }

  getCartQuantity(code: string): number {
    const item = this.items.find(i => i.product.Code === code && !i.isGift && !i.isPromotionItem);
    return item ? item.quantity : 0;
  }

  addToCart(product: Product, quantity = 1): boolean {
    const stock = this.getAvailableStock(product);
    const idx = this.items.findIndex(i => i.product.Code === product.Code && !i.isGift);
    const currentQty = idx >= 0 ? this.items[idx].quantity : 0;
    const newQty = currentQty + quantity;

    if (stock > 0 && newQty > stock) {
      const maxAdd = stock - currentQty;
      if (maxAdd <= 0) {
        this.stockWarningSubject.next(`"${product.FullName || product.Name}" đã đạt tối đa tồn kho (${stock})`);
        return false;
      }
      // Add chỉ số lượng còn lại
      if (idx >= 0) {
        this.items = this.items.map((item, i) =>
          i === idx ? { ...item, quantity: stock } : item
        );
      } else {
        this.items = [...this.items, { product, quantity: maxAdd, unitPriceSaleOff: 0 }];
      }
      this.stockWarningSubject.next(`Chỉ còn ${stock} "${product.FullName || product.Name}" trong kho`);
      this.emit();
      this.recalculatePromotions();
      return false;
    }

    if (idx >= 0) {
      this.items = this.items.map((item, i) =>
        i === idx ? { ...item, quantity: newQty } : item
      );
    } else {
      this.items = [...this.items, { product, quantity, unitPriceSaleOff: 0 }];
    }
    this.emit();
    this.recalculatePromotions();
    return true;
  }

  updateQuantity(code: string, quantity: number): boolean {
    if (quantity <= 0) {
      this.removeFromCart(code);
      return true;
    }
    const item = this.items.find(i => i.product.Code === code);
    if (item?.isGift) return false;

    const stock = item ? this.getAvailableStock(item.product) : 0;
    if (stock > 0 && quantity > stock) {
      this.items = this.items.map(i =>
        i.product.Code === code && !i.isGift ? { ...i, quantity: stock } : i
      );
      this.stockWarningSubject.next(`Chỉ còn ${stock} "${item!.product.FullName || item!.product.Name}" trong kho`);
      this.emit();
      this.recalculatePromotions();
      return false;
    }

    this.items = this.items.map(i =>
      i.product.Code === code && !i.isGift ? { ...i, quantity } : i
    );
    this.emit();
    this.recalculatePromotions();
    return true;
  }

  removeFromCart(code: string): void {
    // Don't allow removing gift/promo items directly
    const item = this.items.find(i => i.product.Code === code);
    if (item?.isGift || item?.isPromotionItem) return;

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
    // Lọc items thực (không phải gift/promo)
    const realItems = this.items.filter(i => !i.isGift && !i.isPromotionItem);
    if (realItems.length === 0) {
      this.items = realItems;
      this.appliedPromotions = [];
      this.totalDiscount = 0;
      this.appliedPromotionsSubject.next([]);
      this.totalDiscountSubject.next(0);
      this.emit();
      return;
    }

    try {
      const result = await this.promotionService.applyPromotionsToCart(realItems);

      // Reset: giữ real items, clear discount + promo fields
      this.items = realItems.map(item => ({
        ...item,
        unitPriceSaleOff: 0,
        promotionId: undefined,
        promotionName: undefined,
      }));

      const allProducts = await this.productApiService.getAllRawCachedProducts();

      // Build product helper
      const buildProduct = (id: string, code: string, name: string, basePrice: number) => {
        const realProduct = allProducts.find(p => p.Code === code);
        return {
          Id: Number(id),
          Code: code,
          Name: realProduct?.Name || name,
          FullName: realProduct?.FullName || name,
          Image: realProduct?.Image || null,
          BasePrice: basePrice || realProduct?.BasePrice || 0,
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
        };
      };

      // Process giftItems from backend (includes Type 1 gifts AND Type 3 discounted)
      for (const gift of result.giftItems) {
        if (gift.isGift) {
          // Type 1: Gift item — free
          const triggerPromo = result.appliedPromotions.find(
            a => a.promotionId === gift.promotionId && a.type === 'gift'
          );
          this.items.push({
            product: buildProduct(gift.productId, gift.code, gift.name, gift.basePrice),
            quantity: gift.quantity,
            unitPriceSaleOff: 0,
            unitPrice: 0,
            totalPrice: 0,
            isGift: true,
            isPromotionItem: true,
            promotionId: gift.promotionId,
            promotionName: triggerPromo?.promotionName || '',
            parentProductId: triggerPromo?.targetProductId,
          });
        } else if ((gift as any).isDiscounted) {
          // Type 3: Buy A get B discounted — separate CartItem
          const basePrice = gift.basePrice || 0;
          let discPerUnit = 0;
          if ((gift as any).discountPercent) {
            // Floor to nearest 1,000 → price rounds up
            discPerUnit = Math.floor(basePrice * (gift as any).discountPercent / 100 / 1000) * 1000;
          } else if ((gift as any).discountAmount) {
            discPerUnit = (gift as any).discountAmount;
          }
          const unitPrice = Math.max(0, basePrice - discPerUnit);
          const triggerPromo = result.appliedPromotions.find(
            a => a.promotionId === (gift as any).promotionId
          );

          this.items.push({
            product: buildProduct(gift.productId, gift.code, gift.name, basePrice),
            quantity: gift.quantity,
            unitPriceSaleOff: discPerUnit,
            unitPrice,
            totalPrice: unitPrice * gift.quantity,
            isGift: false,
            isPromotionItem: true,
            promotionId: (gift as any).promotionId,
            promotionName: (gift as any).promotionName || triggerPromo?.promotionName || '',
            parentProductId: triggerPromo?.targetProductId,
          });
        }
      }

      // Type 2: Direct discount — apply trên chính trigger item
      for (const applied of result.appliedPromotions) {
        if (applied.type === 'gift' || applied.discountAmount <= 0) continue;
        // Skip Type 3 (đã xử lý ở trên qua giftItems)
        const isType3 = result.giftItems.some(
          g => (g as any).promotionId === applied.promotionId && (g as any).isDiscounted
        );
        if (isType3) continue;

        // Type 2: modify trigger item
        const idx = this.items.findIndex(
          i => String(i.product.Id) === applied.targetProductId && !i.isGift && !i.isPromotionItem
        );
        if (idx >= 0) {
          const item = this.items[idx];
          this.items[idx] = {
            ...item,
            unitPriceSaleOff: Math.round(applied.discountAmount / item.quantity),
            promotionId: applied.promotionId,
            promotionName: applied.promotionName,
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
