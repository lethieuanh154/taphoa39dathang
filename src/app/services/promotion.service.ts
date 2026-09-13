import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Promotion, ApplyPromotionResult, CartItem } from '../models/product';
import { SnackbarService } from './snackbar.service';

@Injectable({ providedIn: 'root' })
export class PromotionService {
  private baseUrl = `${environment.domainUrl}/api/firebase/promotions`;

  private activePromotions: Promotion[] = [];
  private promotionsSubject = new BehaviorSubject<Promotion[]>([]);
  promotions$ = this.promotionsSubject.asObservable();

  /** Payload KM ~280KB: chia se giua Home va trang /khuyen-mai thay vi goi lai moi lan dieu huong. */
  private static readonly CACHE_TTL_MS = 60_000;
  private loadedAt = 0;
  private inFlight: Promise<void> | null = null;

  constructor(private http: HttpClient, private snackbar: SnackbarService) {}

  /** @param force bo qua cache (dung khi WebSocket bao KM thay doi). */
  loadActivePromotions(force = false): Promise<void> {
    if (!force && this.inFlight) return this.inFlight;
    if (!force && this.activePromotions.length > 0
        && Date.now() - this.loadedAt < PromotionService.CACHE_TTL_MS) {
      return Promise.resolve();
    }

    this.inFlight = this.fetchActivePromotions().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async fetchActivePromotions(): Promise<void> {
    try {
      const promos = await firstValueFrom(
        this.http.get<Promotion[]>(`${environment.domainUrl}/api/public/promotions/active`)
      );
      this.activePromotions = promos || [];
      this.loadedAt = Date.now();
      this.promotionsSubject.next(this.activePromotions);
    } catch (err) {
      console.error('Failed to load promotions:', err);
      if (!(err instanceof HttpErrorResponse && err.status >= 500)) {
        this.snackbar.error('Không tải được chương trình khuyến mãi.');
      }
      this.loadedAt = 0;
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
      if (!(err instanceof HttpErrorResponse && err.status >= 500)) {
        this.snackbar.error('Không áp dụng được khuyến mãi. Vui lòng thử lại.');
      }
      return { appliedPromotions: [], giftItems: [], totalDiscount: 0 };
    }
  }
}
