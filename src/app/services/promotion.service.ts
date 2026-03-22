import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Promotion, ApplyPromotionResult, CartItem } from '../models/product';

@Injectable({ providedIn: 'root' })
export class PromotionService {
  private baseUrl = `${environment.domainUrl}/api/firebase/promotions`;

  private activePromotions: Promotion[] = [];
  private promotionsSubject = new BehaviorSubject<Promotion[]>([]);
  promotions$ = this.promotionsSubject.asObservable();

  constructor(private http: HttpClient) {}

  async loadActivePromotions(): Promise<void> {
    try {
      const promos = await firstValueFrom(
        this.http.get<Promotion[]>(`${this.baseUrl}/active`)
      );
      this.activePromotions = promos || [];
      this.promotionsSubject.next(this.activePromotions);
    } catch (err) {
      console.error('Failed to load promotions:', err);
      this.activePromotions = [];
      this.promotionsSubject.next([]);
    }
  }

  getActivePromotions(): Promotion[] {
    return this.activePromotions;
  }

  getPromotionsForProduct(productId: string | number): Promotion[] {
    const pid = String(productId);
    return this.activePromotions.filter(p => String(p.targetProductId) === pid);
  }

  hasPromotion(productId: string | number): boolean {
    return this.getPromotionsForProduct(productId).length > 0;
  }

  getPromotionBadge(productId: string | number): string {
    const promos = this.getPromotionsForProduct(productId);
    if (promos.length === 0) return '';

    const promo = promos[0];
    const hasGift = promo.hasGift ?? promo.type === 'gift';
    const hasPct = promo.hasPercentDiscount ?? promo.type === 'percentage';
    const hasFixed = promo.hasFixedDiscount ?? promo.type === 'fixed_amount';

    const parts: string[] = [];
    if (hasGift) parts.push('TANG');
    if (hasPct) parts.push(`-${promo.discountPercent}%`);
    if (hasFixed) {
      const amt = promo.discountAmount || 0;
      parts.push(amt >= 1000 ? `-${Math.round(amt / 1000)}K` : `-${amt}d`);
    }
    return parts.join(' + ') || '';
  }

  async applyPromotionsToCart(cartItems: CartItem[]): Promise<ApplyPromotionResult> {
    const payload = cartItems
      .filter(item => !item.isGift)
      .map(item => ({
        productId: String(item.product.Id),
        code: item.product.Code,
        quantity: item.quantity,
        basePrice: item.product.BasePrice
      }));

    if (payload.length === 0) {
      return { appliedPromotions: [], giftItems: [], totalDiscount: 0 };
    }

    try {
      return await firstValueFrom(
        this.http.post<ApplyPromotionResult>(`${this.baseUrl}/apply`, { cartItems: payload })
      );
    } catch (err) {
      console.error('Apply promotions error:', err);
      return { appliedPromotions: [], giftItems: [], totalDiscount: 0 };
    }
  }
}
