import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PromotionService } from '../../services/promotion.service';
import { Product, Promotion, GiftProduct } from '../../models/product';
import { getPromoBadge, getPromoKind, getDiscountedPrice, getPromoEndTime, getGiftProducts } from '../../shared/promotion-display';

interface FlashItem {
  product: Product;
  promotion: Promotion;
  badge: string;
  price: number;
  oldPrice: number | null;
  /** Qua tang kem (chi KM loai gift) - hien anh canh SP ban. */
  gifts: GiftProduct[];
}

const HIDE_DATE_KEY = 'flashBannerHiddenDate';
const MAX_ITEMS = 4;
const MAX_GIFT_THUMBS = 2;

/** Dong bang nut X: chi nho trong RAM -> refresh trang la hien lai, dieu huong SPA ve Home thi khong. */
let closedThisLoad = false;

/** Popup KM ngan ngay (isFlashBanner) giua Home; "Khong hien lai hom nay" luu theo ngay local. */
@Component({
  selector: 'app-flash-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flash-banner.component.html',
  styleUrls: ['./flash-banner.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FlashBannerComponent implements OnInit, OnDestroy {
  items: FlashItem[] = [];
  visible = false;
  endText = '';
  dontShowToday = false;

  private sub?: Subscription;

  constructor(
    private promotionService: PromotionService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.isSuppressed()) return;
    this.sub = this.promotionService.promotions$.subscribe(promos => {
      this.build(promos);
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /** Checkbox "Khong hien lai hom nay" duoc ap dung khi dong (X / nen toi / bam banner). */
  close(): void {
    closedThisLoad = true;
    if (this.dontShowToday) {
      try { localStorage.setItem(HIDE_DATE_KEY, this.today()); } catch { /* ignore */ }
    }
    this.hide();
  }

  toggleDontShowToday(event: Event): void {
    this.dontShowToday = (event.target as HTMLInputElement).checked;
  }

  openPromotions(): void {
    this.close();
    this.router.navigate(['/khuyen-mai'], { queryParams: { loai: 'flash' } });
  }

  trackById(_: number, it: FlashItem): string {
    return it.promotion.id;
  }

  private hide(): void {
    this.visible = false;
    this.sub?.unsubscribe();
    this.cdr.markForCheck();
  }

  private build(promos: Promotion[]): void {
    const seen = new Set<string>();
    const items: FlashItem[] = [];
    for (const promo of promos) {
      if (!promo.isFlashBanner) continue;
      const product = promo.targetProduct;
      const pid = String(promo.targetProductId);
      if (!product || seen.has(pid) || product.isDeleted || product.isActive === false) continue;
      seen.add(pid);
      const kind = getPromoKind(promo);
      const direct = kind === 'direct';
      items.push({
        product,
        promotion: promo,
        badge: getPromoBadge(promo),
        price: direct ? getDiscountedPrice(product.BasePrice, promo) : product.BasePrice,
        oldPrice: direct ? product.BasePrice : null,
        gifts: kind === 'gift' ? getGiftProducts(promo).slice(0, MAX_GIFT_THUMBS) : []
      });
      if (items.length >= MAX_ITEMS) break;
    }
    this.items = items;
    this.visible = items.length > 0;
    this.endText = this.formatEnd(items);
  }

  private formatEnd(items: FlashItem[]): string {
    const ends = items.map(i => getPromoEndTime(i.promotion)).filter(t => t > 0);
    if (ends.length === 0) return '';
    const days = Math.ceil((Math.min(...ends) - Date.now()) / 86400000);
    return days <= 1 ? 'Kết thúc hôm nay' : `Chỉ còn ${days} ngày`;
  }

  private isSuppressed(): boolean {
    if (closedThisLoad) return true;
    try {
      return localStorage.getItem(HIDE_DATE_KEY) === this.today();
    } catch {
      return false;
    }
  }

  private today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
}
