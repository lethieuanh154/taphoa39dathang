import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { HeaderComponent } from '../header/header.component';
import { CartPanelComponent } from '../cart-panel/cart-panel.component';
import { ProductDetailComponent } from '../product-detail/product-detail.component';
import { ProductApiService } from '../../services/product-api.service';
import { PromotionService } from '../../services/promotion.service';
import { GroupService } from '../../services/group.service';
import { CartService } from '../../services/cart.service';
import { Product, Promotion, GiftProduct } from '../../models/product';
import {
  PromoKind, getPromoKind, getPromoKindLabel, getPromoBadge, getPromoDetail,
  getPromoCondition, getGiftProducts, getDiscountedPrice
} from '../../shared/promotion-display';

type FilterKind = 'all' | PromoKind;

interface PromoCard {
  promotion: Promotion;
  product: Product;
  kind: PromoKind;
  kindLabel: string;
  badge: string;
  detail: string;
  condition: string;
  gifts: GiftProduct[];
  /** Gia sau giam cua chinh san pham A (chi voi KM giam gia truc tiep). */
  discountedPrice: number | null;
  endText: string;
}

@Component({
  selector: 'app-promotion-page',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent, CartPanelComponent, ProductDetailComponent],
  templateUrl: './promotion-page.component.html',
  styleUrls: ['./promotion-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PromotionPageComponent implements OnInit, OnDestroy {
  isLoading = true;
  cards: PromoCard[] = [];
  activeFilter: FilterKind = 'all';

  detailProduct: Product | null = null;
  detailGroup: Product[] = [];
  detailPromotion: Promotion | null = null;

  private promoSub?: Subscription;

  readonly filters: { key: FilterKind; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'gift', label: 'Mua tặng quà' },
    { key: 'direct', label: 'Giảm giá trực tiếp' },
    { key: 'buy_a_get_b', label: 'Mua kèm giá ưu đãi' }
  ];

  constructor(
    private productApi: ProductApiService,
    private promotionService: PromotionService,
    private groupService: GroupService,
    private cartService: CartService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.productApi.initialize()
      .catch(() => {})
      .then(() => this.load());

    this.promoSub = this.productApi.getPromotionsUpdated$().subscribe(() => {
      this.load();
      this.cartService.recalculatePromotions();
    });
  }

  ngOnDestroy(): void {
    this.promoSub?.unsubscribe();
  }

  get visibleCards(): PromoCard[] {
    return this.activeFilter === 'all'
      ? this.cards
      : this.cards.filter(c => c.kind === this.activeFilter);
  }

  countOf(key: FilterKind): number {
    return key === 'all' ? this.cards.length : this.cards.filter(c => c.kind === key).length;
  }

  setFilter(key: FilterKind): void {
    this.activeFilter = key;
    this.cdr.markForCheck();
  }

  onSearch(term: string): void {
    if (!term.trim()) return;
    this.router.navigate(['/'], { queryParams: { q: term.trim() } });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  private async load(): Promise<void> {
    this.isLoading = true;
    this.cdr.markForCheck();

    await this.promotionService.loadActivePromotions();
    const promos = this.promotionService.getActivePromotions();

    const cards: PromoCard[] = [];
    const toCache: Product[] = [];

    for (const promo of promos) {
      const product = promo.targetProduct;
      if (!product || product.isDeleted || product.isActive === false) continue;
      if (product.CategoryId === 1440125 || product.CategoryId === 1787413) continue;

      const kind = getPromoKind(promo);
      cards.push({
        promotion: promo,
        product,
        kind,
        kindLabel: getPromoKindLabel(promo),
        badge: getPromoBadge(promo),
        detail: getPromoDetail(promo),
        condition: getPromoCondition(promo),
        gifts: getGiftProducts(promo),
        discountedPrice: kind === 'direct' ? getDiscountedPrice(product.BasePrice, promo) : null,
        endText: this.formatEnd(promo.toDate)
      });
      toCache.push(product);
    }

    // Gift product cung phai co trong cache de gio hang resolve duoc
    for (const c of cards) {
      for (const g of c.gifts) toCache.push(g as unknown as Product);
    }

    // Nhom theo loai KM cho de doc: tang qua -> mua kem -> giam gia
    const order: Record<PromoKind, number> = { gift: 0, buy_a_get_b: 1, direct: 2 };
    cards.sort((a, b) => order[a.kind] - order[b.kind]
      || (b.promotion.priority || 0) - (a.promotion.priority || 0));

    this.cards = cards;
    this.isLoading = false;
    this.cdr.markForCheck();

    if (toCache.length > 0) {
      this.productApi.cacheProducts(toCache).catch(() => {});
    }
  }

  private formatEnd(toDate: string | undefined): string {
    if (!toDate) return '';
    const end = new Date(toDate).getTime();
    if (!Number.isFinite(end)) return '';
    const days = Math.ceil((end - Date.now()) / 86400000);
    if (days <= 0) return 'Kết thúc hôm nay';
    if (days === 1) return 'Còn 1 ngày';
    if (days <= 30) return `Còn ${days} ngày`;
    return `Đến ${new Date(toDate).toLocaleDateString('vi-VN')}`;
  }

  /** Gia uu dai cua san pham mua kem (Type 3) - giam ap len gift, khong phai target. */
  giftDealPrice(card: PromoCard, gift: GiftProduct): number {
    return getDiscountedPrice(gift.BasePrice || 0, card.promotion);
  }

  isBuyAGetB(card: PromoCard): boolean {
    return card.kind === 'buy_a_get_b';
  }

  async openDetail(card: PromoCard): Promise<void> {
    const p = card.product;
    const masterId = p.MasterUnitId === null || p.MasterUnitId === undefined
      ? p.Id
      : Number(p.MasterUnitId);

    let group: Product[] = [p];
    try {
      const cached = await this.productApi.getAllCachedProducts();
      const grouped = this.groupService.group(
        cached.filter(x => Number(x.MasterUnitId ?? x.Id) === masterId || Number(x.Id) === masterId)
      );
      group = grouped[masterId] && grouped[masterId].length > 0 ? grouped[masterId] : [p];
    } catch { /* fallback: chi 1 don vi */ }

    this.detailGroup = group;
    this.detailProduct = p;
    this.detailPromotion = card.promotion;
    this.cdr.markForCheck();
  }

  onDetailClose(): void {
    this.detailProduct = null;
    this.detailGroup = [];
    this.detailPromotion = null;
    this.cdr.markForCheck();
  }

  trackByPromoId(_: number, card: PromoCard): string {
    return card.promotion.id;
  }
}
