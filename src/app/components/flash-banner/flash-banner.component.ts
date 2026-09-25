import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PromotionService } from '../../services/promotion.service';
import { Product, Promotion, GiftProduct } from '../../models/product';
import { PromoKind, getPromoBadge, getPromoKind, getDiscountedPrice, getPromoEndTime, getGiftProducts } from '../../shared/promotion-display';

interface FlashGift {
  product: GiftProduct;
  /** Nhan goc anh: "🎁 x1" (tang qua) hoac "-20%" (SP B mua kem gia uu dai). */
  tag: string;
  title: string;
}

interface FlashItem {
  product: Product;
  promotion: Promotion;
  badge: string;
  price: number;
  oldPrice: number | null;
  /** Qua tang (gift) / SP B mua kem (buy_a_get_b) - hien anh canh SP ban. */
  gifts: FlashGift[];
}

const HIDE_DATE_KEY = 'flashBannerHiddenDate';
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
  canPrev = false;
  canNext = false;

  @ViewChild('track') private trackRef?: ElementRef<HTMLElement>;

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

  /** Cuon 1 trang (bang be rong khung) sang trai/phai. */
  scrollBy(dir: -1 | 1, event: Event): void {
    event.stopPropagation();
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
  }

  updateArrows(): void {
    const el = this.trackRef?.nativeElement;
    const prev = !!el && el.scrollLeft > 4;
    const next = !!el && el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    if (prev !== this.canPrev || next !== this.canNext) {
      this.canPrev = prev;
      this.canNext = next;
      this.cdr.markForCheck();
    }
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
    // Hien theo tung campaign (1 SP co the co nhieu campaign flash), BE da gioi han so SP
    const items: FlashItem[] = [];
    for (const promo of promos) {
      if (!promo.isFlashBanner) continue;
      const product = promo.targetProduct;
      if (!product || product.isDeleted || product.isActive === false) continue;
      const kind = getPromoKind(promo);
      const direct = kind === 'direct';
      items.push({
        product,
        promotion: promo,
        badge: kind === 'buy_a_get_b' ? 'MUA KÈM' : getPromoBadge(promo),
        price: direct ? getDiscountedPrice(product.BasePrice, promo) : product.BasePrice,
        oldPrice: direct ? product.BasePrice : null,
        gifts: this.buildGifts(promo, kind)
      });
    }
    this.items = items;
    this.visible = items.length > 0;
    this.endText = this.formatEnd(items);
    setTimeout(() => this.updateArrows());
  }

  private buildGifts(promo: Promotion, kind: PromoKind): FlashGift[] {
    if (kind === 'direct') return [];
    const deal = kind === 'buy_a_get_b';
    return getGiftProducts(promo).slice(0, MAX_GIFT_THUMBS).map(g => ({
      product: g,
      tag: deal ? getPromoBadge(promo) : `🎁 x${g.GiftQuantity}`,
      title: deal
        ? `Mua kèm ${g.Name} còn ${getDiscountedPrice(g.BasePrice || 0, promo).toLocaleString('vi-VN')}đ`
        : `Tặng ${g.GiftQuantity} ${g.Name}`
    }));
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
