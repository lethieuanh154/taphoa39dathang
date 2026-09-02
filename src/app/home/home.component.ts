import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Subscription } from 'rxjs';
import { HeaderComponent } from '../components/header/header.component';
import { ProductCardComponent } from '../components/product-card/product-card.component';
import { CartPanelComponent } from '../components/cart-panel/cart-panel.component';
import { ProductDetailComponent } from '../components/product-detail/product-detail.component';
import { CustomerIdentityDialogComponent, IdentityConfirmedEvent } from '../components/customer-identity-dialog/customer-identity-dialog.component';
import { ProfileBubbleComponent } from '../components/profile-bubble/profile-bubble.component';
import { DraggableBubbleDirective } from '../directives/draggable-bubble.directive';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PolicyFooterComponent } from '../components/policy-footer/policy-footer.component';
import { ProductApiService } from '../services/product-api.service';
import { GroupService } from '../services/group.service';
import { PromotionService } from '../services/promotion.service';
import { CartService } from '../services/cart.service';
import { SnackbarService } from '../services/snackbar.service';
import { Product, Promotion } from '../models/product';
import { getCategoryVisual } from '../shared/category-icon';
import {
  getPromoBadge, getPromoDetail, getDiscountedPrice, getPromoKind,
  hasAnyDiscount, getPromoEndTime
} from '../shared/promotion-display';

interface Category {
  Id: number;
  Name: string;
  Path: string;
  icon?: string;
  gradient?: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent, ProductCardComponent, CartPanelComponent, ProductDetailComponent, CustomerIdentityDialogComponent, ProfileBubbleComponent, DraggableBubbleDirective, PolicyFooterComponent] as const,
  templateUrl: './home.component.html',
  styleUrls: ['./home.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, OnDestroy {
  private categoryScrollEl?: HTMLElement;
  showLeftArrow = false;
  showRightArrow = false;

  @ViewChild('categoryScroll') set categoryScrollRef(ref: ElementRef<HTMLElement> | undefined) {
    if (ref) {
      const el = ref.nativeElement;
      if (el !== this.categoryScrollEl) {
        this.categoryScrollEl = el;
        this.initCategoryDragScroll();
        el.addEventListener('scroll', () => this.updateArrowVisibility());
        // Initial check after layout
        setTimeout(() => this.updateArrowVisibility(), 100);
      }
    }
  }

  private promoScrollEl?: HTMLElement;
  showPromoLeftArrow = false;
  showPromoRightArrow = false;

  @ViewChild('promoScroll') set promoScrollRef(ref: ElementRef<HTMLElement> | undefined) {
    if (ref && ref.nativeElement !== this.promoScrollEl) {
      const el = ref.nativeElement;
      this.promoScrollEl = el;
      el.addEventListener('scroll', () => this.updatePromoArrows());
      setTimeout(() => this.updatePromoArrows(), 100);
    }
  }

  /** Dem nguoc toi luc KM gan nhat het han. */
  countdown: { h: string; m: string; s: string } | null = null;
  private countdownTimer?: ReturnType<typeof setInterval>;

  // All master products from search/category (after grouping)
  private allMasterProducts: Product[] = [];
  // Displayed subset for infinite scroll
  displayedProducts: Product[] = [];
  // Grouped products map for unit switching in detail dialog
  groupedProducts: Record<number, Product[]> = {};

  isLoading = false;
  isLoadingMore = false;
  hasSearched = false;
  footerHidden = false;
  // Pagination state for API-based infinite scroll
  private currentOffset = 0;
  private hasMore = true;
  private currentMode: 'featured' | 'category' | 'search' = 'featured';

  // Product detail dialog
  detailProduct: Product | null = null;
  detailGroup: Product[] = [];
  isDetailSale = false;
  detailPromotion: Promotion | null = null;

  // Discount bar - replaced by real promotions
  discountProducts: Product[] = []; // kept for backward compat in template

  // Customer identity
  showIdentityDialog = false;
  customerIdentity: string | null = null;

  // Change password popup
  showChangePasswordPopup = false;
  newPassword = '';
  showNewPassword = false;
  changePasswordSubmitting = false;
  changePasswordMessage = '';

  // Category bar
  categories: Category[] = [];
  activeCategory: Category | null = null;

  private readonly PAGE_SIZE = 20;
  private lastSearchTerm = '';
  private pendingQuery = '';
  private updateSub?: Subscription;
  private promoSub?: Subscription;
  private cartExpiredSub?: Subscription;

  // Promotion bar - products with active promotions
  promotionProducts: { product: Product; promotion: Promotion }[] = [];

  constructor(
    private productApi: ProductApiService,
    private groupService: GroupService,
    private promotionService: PromotionService,
    private cartService: CartService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    private snackbar: SnackbarService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Giỏ hàng quá 24h đã bị xoá → báo khách chọn lại (nút checkout tự ẩn vì giỏ trống)
    this.cartExpiredSub = this.cartService.cartExpired$.subscribe(expired => {
      if (expired) {
        this.snackbar.warning('Giỏ hàng đã hết hạn sau 24 giờ. Vui lòng chọn lại sản phẩm.');
      }
    });

    // Tu trang KM chuyen ve kem ?q= -> mo ket qua tim kiem ngay
    this.pendingQuery = (this.route.snapshot.queryParamMap.get('q') || '').trim();

    const storedIdentity = CustomerIdentityDialogComponent.getStoredIdentity();
    if (storedIdentity) {
      this.customerIdentity = storedIdentity;
      this.initProducts();
    } else {
      this.showIdentityDialog = true;
    }
  }

  onIdentityConfirmed(event: IdentityConfirmedEvent): void {
    this.customerIdentity = event.identity;
    this.showIdentityDialog = false;
    this.cdr.markForCheck();
    this.initProducts();

    // Old customer without password → suggest setting one
    if (!event.hasPassword) {
      this.showChangePasswordPopup = true;
      this.cdr.markForCheck();
    }
  }

  onChangePassword(): void {
    const pw = this.newPassword.trim();
    if (!pw || pw.length < 4 || this.changePasswordSubmitting) return;

    this.changePasswordSubmitting = true;
    this.changePasswordMessage = '';
    this.cdr.markForCheck();

    this.http.post<any>(`${environment.domainUrl}/api/chat/change-password`, {
      identity: this.customerIdentity,
      newPassword: pw
    }).subscribe({
      next: (res) => {
        this.changePasswordSubmitting = false;
        if (res?.success) {
          this.showChangePasswordPopup = false;
          this.newPassword = '';
        } else {
          this.changePasswordMessage = res?.message || 'Lỗi đổi mật khẩu';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.changePasswordSubmitting = false;
        this.changePasswordMessage = err?.error?.message || 'Lỗi kết nối';
        this.cdr.markForCheck();
      }
    });
  }

  onSkipChangePassword(): void {
    this.showChangePasswordPopup = false;
    this.newPassword = '';
    this.changePasswordMessage = '';
    this.cdr.markForCheck();
  }

  onLogout(): void {
    this.customerIdentity = null;
    this.showIdentityDialog = true;
    this.detailProduct = null;
    this.cdr.markForCheck();
  }

  private initProducts(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.productApi.initialize().then(async () => {
      // Purge hidden-category products (e.g. "Thuốc lá") from IndexedDB
      await this.productApi.purgeHiddenCategoryProducts().catch(() => {});
      // Load categories after DB is initialized to avoid race condition
      this.loadCategories();
      // Show featured products on initial load (no search needed)
      this.applyInitialView();
      this.loadPromotionProducts();
    }).catch(err => {
      console.error('[Home] Initialize failed:', err);
      // Still try to load products even if IndexedDB init failed
      this.loadCategories();
      this.applyInitialView();
      this.loadPromotionProducts();
    });

    this.updateSub = this.productApi.getProductUpdated$().subscribe(() => {
      // Refresh promotion products on WS update
      this.refreshPromotionProducts();
    });

    // Listen for promotion changes via WebSocket (created/updated/deleted/toggled in BanHang)
    this.promoSub = this.productApi.getPromotionsUpdated$().subscribe(() => {
      this.loadPromotionProducts();
      // Recalculate cart promotions with updated promotion data
      this.cartService.recalculatePromotions();
    });
  }

  ngOnDestroy(): void {
    this.updateSub?.unsubscribe();
    this.promoSub?.unsubscribe();
    this.cartExpiredSub?.unsubscribe();
    this.stopCountdown();
  }

  private initCategoryDragScroll(): void {
    const el = this.categoryScrollEl;
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    el.addEventListener('mousedown', (e: MouseEvent) => {
      isDown = true;
      el.style.cursor = 'grabbing';
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    });
    el.addEventListener('mouseleave', () => { isDown = false; el.style.cursor = ''; });
    el.addEventListener('mouseup', () => { isDown = false; el.style.cursor = ''; });
    el.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      el.scrollLeft = scrollLeft - (x - startX);
    });
    // Mouse wheel → horizontal scroll
    el.addEventListener('wheel', (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const scrollY = window.scrollY;

    // Footer: hide when scrolling down, show when near top
    this.footerHidden = scrollY > 100;

    // Infinite scroll - load more from API
    const scrollPosition = window.innerHeight + scrollY;
    const docHeight = document.documentElement.scrollHeight;

    if (scrollPosition >= docHeight - 200 && !this.isLoadingMore && this.hasMore) {
      this.loadMore();
    }

    this.cdr.markForCheck();
  }

  // ======================== Search ========================

  onSearch(term: string): void {
    if (!term.trim()) return;

    this.activeCategory = null;
    this.lastSearchTerm = term;
    this.isLoading = true;
    this.hasSearched = true;
    this.cdr.markForCheck();
    this.doSearch(term);
  }

  private async doSearch(term: string): Promise<void> {
    this.currentMode = 'search';
    this.hasMore = false;
    this.clearProducts();
    try {
      const results = await this.productApi.searchProducts(term);
      this.appendProducts(results);
    } catch {
      this.clearProducts();
    }
    this.isLoading = false;
    this.cdr.markForCheck();
  }

  // ======================== Category ========================

  onCategoryClick(category: Category): void {
    this.activeCategory = category;
    this.lastSearchTerm = '';
    this.isLoading = true;
    this.hasSearched = true;
    this.cdr.markForCheck();
    this.loadCategoryProducts(category);
  }

  private async loadCategoryProducts(category: Category): Promise<void> {
    this.currentMode = 'category';
    this.currentOffset = 0;
    this.hasMore = true;
    this.clearProducts();

    try {
      const { products, hasMore } = await this.productApi.loadByCategory(category.Id, this.PAGE_SIZE, 0);
      this.appendProducts(products);
      this.hasMore = hasMore;
      this.currentOffset = products.length;
    } catch {
      this.clearProducts();
    }
    this.isLoading = false;
    this.cdr.markForCheck();
    this.fillViewport();
  }

  // ======================== Featured (initial) ========================

  /** Mo ket qua tim kiem neu vao trang kem ?q=, khong thi hien SP noi bat. */
  private applyInitialView(): void {
    const q = this.pendingQuery;
    this.pendingQuery = '';
    if (q) {
      this.onSearch(q);
    } else {
      this.loadFeaturedDisplay();
    }
  }

  private async loadFeaturedDisplay(): Promise<void> {
    this.currentMode = 'featured';
    this.currentOffset = 0;
    this.hasMore = true;
    this.clearProducts();

    try {
      const { products, hasMore } = await this.productApi.loadFeaturedProducts(this.PAGE_SIZE, 0);
      this.appendProducts(products);
      this.hasMore = hasMore;
      this.currentOffset = products.length;
      this.hasSearched = true;
    } catch {
      this.clearProducts();
    }
    this.isLoading = false;
    this.cdr.markForCheck();
    this.fillViewport();
  }

  /**
   * Desktop fix: wide multi-column grid can render the first page shorter than
   * the viewport → no scrollbar → window:scroll never fires → loadMore never runs.
   * Keep loading until the page is tall enough to scroll (or no more data).
   * On phone the 2-column grid is already taller than the viewport, so the loop
   * exits immediately and behavior is unchanged.
   */
  private async fillViewport(): Promise<void> {
    let guard = 0;
    while (this.hasMore && !this.isLoadingMore && guard < 10) {
      // Wait for the just-rendered products to lay out before measuring height.
      await new Promise(resolve => setTimeout(resolve, 50));
      if (document.documentElement.scrollHeight > window.innerHeight + 100) break;
      guard++;
      await this.loadMore();
    }
  }

  // ======================== Product display helpers ========================

  private isPromoFreeProduct(p: Product): boolean {
    if (p.BasePrice > 0) return false;
    const name = (p.Name || p.FullName || '').trim();
    return /[_\s]?[Kk][Mm](\s*\(|$|\s)/.test(name) || name.toUpperCase().endsWith('KM');
  }

  private appendProducts(results: Product[]): void {
    results = results.filter(p => !this.isPromoFreeProduct(p));
    const grouped = this.groupService.group(results);
    // Merge new grouped products into existing
    Object.assign(this.groupedProducts, grouped);

    const newMasters = Object.values(grouped).map(group => group[0]);
    // Sort: in-stock first
    newMasters.sort((a, b) => {
      const stockA = a.OnHand + (a.CloneOnHandNV || 0);
      const stockB = b.OnHand + (b.CloneOnHandNV || 0);
      return (stockB > 0 ? 1 : 0) - (stockA > 0 ? 1 : 0);
    });

    // Avoid duplicates
    const existingIds = new Set(this.allMasterProducts.map(p => p.Id));
    for (const p of newMasters) {
      if (!existingIds.has(p.Id)) {
        this.allMasterProducts.push(p);
      }
    }
    this.displayedProducts = [...this.allMasterProducts];
  }

  private clearProducts(): void {
    this.allMasterProducts = [];
    this.displayedProducts = [];
    this.groupedProducts = {};
  }

  private async loadMore(): Promise<void> {
    if (this.isLoadingMore || !this.hasMore) return;

    this.isLoadingMore = true;
    this.cdr.markForCheck();

    try {
      let result: { products: Product[]; hasMore: boolean };

      if (this.currentMode === 'category' && this.activeCategory) {
        result = await this.productApi.loadByCategory(this.activeCategory.Id, this.PAGE_SIZE, this.currentOffset);
      } else if (this.currentMode === 'featured') {
        result = await this.productApi.loadFeaturedProducts(this.PAGE_SIZE, this.currentOffset);
      } else {
        // Search mode — already fully loaded
        this.isLoadingMore = false;
        this.cdr.markForCheck();
        return;
      }

      this.appendProducts(result.products);
      this.currentOffset += result.products.length;
      this.hasMore = result.hasMore;
    } catch (err) {
      console.error('[Home] loadMore failed:', err);
      this.hasMore = false;
    }

    this.isLoadingMore = false;
    this.cdr.markForCheck();
  }

  // ======================== Product detail ========================

  onProductClick(product: Product, isSale = false): void {
    const masterId = product.MasterUnitId === null || product.MasterUnitId === undefined
      ? product.Id
      : (Number(product.MasterUnitId) === product.Id ? product.Id : Number(product.MasterUnitId));

    this.detailGroup = this.groupedProducts[masterId] || [product];
    this.detailProduct = product;
    this.isDetailSale = isSale;
    this.cdr.markForCheck();
  }

  onDetailClose(): void {
    this.detailProduct = null;
    this.detailGroup = [];
    this.isDetailSale = false;
    this.detailPromotion = null;
    this.cdr.markForCheck();
  }

  // ======================== Promotion bar ========================

  private async loadPromotionProducts(): Promise<void> {
    await this.promotionService.loadActivePromotions();
    const promos = this.promotionService.getActivePromotions();
    if (promos.length === 0) {
      this.promotionProducts = [];
      this.discountProducts = [];
      this.stopCountdown();
      this.countdown = null;
      this.cdr.markForCheck();
      return;
    }

    // Use embedded targetProduct from API (no IndexedDB dependency)
    const seen = new Set<string>();
    this.promotionProducts = [];
    const productsToCache: Product[] = [];

    for (const promo of promos) {
      const pid = String(promo.targetProductId);
      if (seen.has(pid)) continue;
      const product = promo.targetProduct;
      if (product && !product.isDeleted && product.isActive !== false && product.CategoryId !== 1440125 && product.CategoryId !== 1787413) {
        seen.add(pid);
        this.promotionProducts.push({ product, promotion: promo });
        productsToCache.push(product);
      }
    }

    // Keep discountProducts for template backward compat
    this.discountProducts = this.promotionProducts.map(pp => pp.product);
    this.startCountdown();
    this.cdr.markForCheck();
    setTimeout(() => this.updatePromoArrows(), 150);

    // Cache promotion products to IndexedDB (fire-and-forget for cart/detail use)
    if (productsToCache.length > 0) {
      this.productApi.cacheProducts(productsToCache).catch(() => {});
    }
  }

  private async refreshPromotionProducts(): Promise<void> {
    if (this.promotionProducts.length === 0) return;
    const allProducts = await this.productApi.getAllCachedProducts();
    const productMap = new Map(allProducts.map(p => [String(p.Id), p]));

    this.promotionProducts = this.promotionProducts
      .map(pp => {
        const updated = productMap.get(String(pp.product.Id));
        return updated ? { product: updated, promotion: pp.promotion } : pp;
      });
    this.discountProducts = this.promotionProducts.map(pp => pp.product);
    this.cdr.markForCheck();
  }

  onDiscountProductClick(product: Product): void {
    const pp = this.promotionProducts.find(p => p.product.Id === product.Id);
    this.detailPromotion = pp ? pp.promotion : null;
    this.onProductClick(product, true);
  }

  isGiftOnlyPromo(promo: Promotion): boolean {
    return getPromoKind(promo) === 'gift';
  }

  hasDiscountPromo(promo: Promotion): boolean {
    return hasAnyDiscount(promo);
  }

  getPromotionBadge(promo: Promotion): string {
    return getPromoBadge(promo);
  }

  getPromotionDetail(promo: Promotion): string {
    return getPromoDetail(promo);
  }

  /** Gia hien thi tren the KM: giam truc tiep thi lay gia sau giam, con lai lay gia goc. */
  promoPrice(pp: { product: Product; promotion: Promotion }): number {
    return getPromoKind(pp.promotion) === 'direct'
      ? getDiscountedPrice(pp.product.BasePrice, pp.promotion)
      : pp.product.BasePrice;
  }

  goToPromotions(): void {
    this.router.navigate(['/khuyen-mai']);
  }

  scrollPromoLeft(): void {
    this.promoScrollEl?.scrollBy({ left: -280, behavior: 'smooth' });
  }

  scrollPromoRight(): void {
    this.promoScrollEl?.scrollBy({ left: 280, behavior: 'smooth' });
  }

  private updatePromoArrows(): void {
    const el = this.promoScrollEl;
    if (!el) return;
    const left = el.scrollLeft > 5;
    const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 5;
    if (left !== this.showPromoLeftArrow || right !== this.showPromoRightArrow) {
      this.showPromoLeftArrow = left;
      this.showPromoRightArrow = right;
      this.cdr.detectChanges();
    }
  }

  /** Dem nguoc toi KM het han som nhat (chi hien khi con duoi 24h). */
  private startCountdown(): void {
    this.stopCountdown();
    const ends = this.promotionProducts
      .map(pp => getPromoEndTime(pp.promotion))
      .filter(t => t > Date.now());
    if (ends.length === 0) {
      this.countdown = null;
      return;
    }
    const nearest = Math.min(...ends);

    const tick = () => {
      const left = nearest - Date.now();
      if (left <= 0 || left > 86400000) {
        this.countdown = null;
        this.stopCountdown();
      } else {
        const h = Math.floor(left / 3600000);
        const m = Math.floor((left % 3600000) / 60000);
        const sec = Math.floor((left % 60000) / 1000);
        const pad = (n: number) => String(n).padStart(2, '0');
        this.countdown = { h: pad(h), m: pad(m), s: pad(sec) };
      }
      this.cdr.markForCheck();
    };

    tick();
    if (this.countdown) {
      this.countdownTimer = setInterval(tick, 1000);
    }
  }

  private stopCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = undefined;
    }
  }

  // ======================== Category bubble menu ========================

  private async loadCategories(): Promise<void> {
    try {
      const list = (await this.productApi.loadCategories()).filter(c => c.Id !== 1440125 && c.Id !== 1787413);
      this.categories = list.map((c, i) => ({ ...c, ...getCategoryVisual(c.Name, i) }));
      this.cdr.markForCheck();
    } catch {
      this.categories = [];
    }
  }

  private updateArrowVisibility(): void {
    const el = this.categoryScrollEl;
    if (!el) return;
    this.showLeftArrow = el.scrollLeft > 5;
    this.showRightArrow = el.scrollLeft < el.scrollWidth - el.clientWidth - 5;
    this.cdr.detectChanges();
  }

  scrollCategoryLeft(): void {
    if (!this.categoryScrollEl) return;
    this.categoryScrollEl.scrollBy({ left: -200, behavior: 'smooth' });
  }

  scrollCategoryRight(): void {
    if (!this.categoryScrollEl) return;
    this.categoryScrollEl.scrollBy({ left: 200, behavior: 'smooth' });
  }

  onShowAllClick(): void {
    this.activeCategory = null;
    this.lastSearchTerm = '';
    this.isLoading = true;
    this.cdr.markForCheck();
    this.loadFeaturedDisplay();
  }

  getMarketPrice(basePrice: number): number {
    return Math.round((basePrice * 1.10) / 500) * 500;
  }
  trackByProductCode(_: number, product: Product): string {
    return product.Code;
  }

  trackByCategoryId(_: number, cat: Category): number {
    return cat.Id;
  }

  trackByPromoId(_: number, pp: { product: Product; promotion: Promotion }): string {
    return pp.promotion.id;
  }

}
