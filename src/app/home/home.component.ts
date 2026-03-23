import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, HostListener } from '@angular/core';
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
import { ChatBubbleComponent } from '../components/chat-bubble/chat-bubble.component';
import { ProfileBubbleComponent } from '../components/profile-bubble/profile-bubble.component';
import { DraggableBubbleDirective } from '../directives/draggable-bubble.directive';
import { ProductApiService } from '../services/product-api.service';
import { GroupService } from '../services/group.service';
import { PromotionService } from '../services/promotion.service';
import { Product, Promotion } from '../models/product';

interface Category {
  Id: number;
  Name: string;
  Path: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, ProductCardComponent, CartPanelComponent, ProductDetailComponent, CustomerIdentityDialogComponent, ChatBubbleComponent, ProfileBubbleComponent, DraggableBubbleDirective] as const,
  templateUrl: './home.component.html',
  styleUrls: ['./home.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, OnDestroy {

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

  // Category bubble menu
  categories: Category[] = [];
  isBubbleMenuOpen = false;
  activeCategory: Category | null = null;

  private readonly PAGE_SIZE = 20;
  private lastSearchTerm = '';
  private updateSub?: Subscription;

  // Promotion bar - products with active promotions
  promotionProducts: { product: Product; promotion: Promotion }[] = [];

  constructor(
    private productApi: ProductApiService,
    private groupService: GroupService,
    private promotionService: PromotionService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
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

  private initProducts(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.productApi.initialize().then(() => {
      // Load categories after DB is initialized to avoid race condition
      this.loadCategories();
      // Show featured products on initial load (no search needed)
      this.loadFeaturedDisplay();
      this.loadPromotionProducts();
    });

    this.updateSub = this.productApi.getProductUpdated$().subscribe(() => {
      // Refresh promotion products on WS update
      this.refreshPromotionProducts();
    });
  }

  ngOnDestroy(): void {
    this.updateSub?.unsubscribe();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const scrollY = window.scrollY;

    // Footer: hide when scrolling down, only show when scrolled back near the top (header area)
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
    this.isBubbleMenuOpen = false;
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
  }

  // ======================== Featured (initial) ========================

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
  }

  // ======================== Product display helpers ========================

  private appendProducts(results: Product[]): void {
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
      if (product && !product.isDeleted && product.isActive !== false) {
        seen.add(pid);
        this.promotionProducts.push({ product, promotion: promo });
        productsToCache.push(product);
      }
    }

    // Keep discountProducts for template backward compat
    this.discountProducts = this.promotionProducts.map(pp => pp.product);
    this.cdr.markForCheck();

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
    const hasGift = promo.hasGift ?? promo.type === 'gift';
    const hasPct = promo.hasPercentDiscount ?? promo.type === 'percentage';
    const hasFixed = promo.hasFixedDiscount ?? promo.type === 'fixed_amount';
    return hasGift && !hasPct && !hasFixed;
  }

  hasDiscountPromo(promo: Promotion): boolean {
    return (promo.hasPercentDiscount ?? promo.type === 'percentage')
      || (promo.hasFixedDiscount ?? promo.type === 'fixed_amount');
  }

  getPromotionBadge(product: Product): string {
    const pp = this.promotionProducts.find(p => p.product.Id === product.Id);
    if (!pp) return 'SALE';
    const promo = pp.promotion;
    const hasGift = promo.hasGift ?? promo.type === 'gift';
    const hasPct = promo.hasPercentDiscount ?? promo.type === 'percentage';
    const hasFixed = promo.hasFixedDiscount ?? promo.type === 'fixed_amount';

    const parts: string[] = [];
    if (hasGift) parts.push('TẶNG');
    if (hasPct) parts.push(`-${promo.discountPercent}%`);
    if (hasFixed) {
      const amt = promo.discountAmount || 0;
      parts.push(amt >= 1000 ? `-${Math.round(amt / 1000)}K` : `-${amt} đ`);
    }
    return parts.join(' + ') || 'SALE';
  }

  getPromotionDetail(product: Product): string {
    const pp = this.promotionProducts.find(p => p.product.Id === product.Id);
    if (!pp) return '';
    const promo = pp.promotion;
    const hasGift = promo.hasGift ?? promo.type === 'gift';
    const hasPct = promo.hasPercentDiscount ?? promo.type === 'percentage';
    const hasFixed = promo.hasFixedDiscount ?? promo.type === 'fixed_amount';

    const parts: string[] = [];
    if (hasGift && promo.giftProductName) parts.push(`Tặng ${promo.giftProductName}`);
    if (hasPct && promo.discountPercent) parts.push(`Giảm ${promo.discountPercent}%`);
    if (hasFixed && promo.discountAmount) parts.push(`Giảm ${promo.discountAmount.toLocaleString()}d`);
    return parts.join(' + ') || '';
  }

  getDiscountedPrice(product: Product): number {
    const pp = this.promotionProducts.find(p => p.product.Id === product.Id);
    if (!pp) return product.BasePrice;
    const promo = pp.promotion;
    const hasPct = promo.hasPercentDiscount ?? promo.type === 'percentage';
    const hasFixed = promo.hasFixedDiscount ?? promo.type === 'fixed_amount';

    let price = product.BasePrice;
    if (hasPct && promo.discountPercent) {
      price = Math.round(price * (1 - promo.discountPercent / 100));
    }
    if (hasFixed && promo.discountAmount) {
      price = Math.max(0, price - promo.discountAmount);
    }
    return price;
  }

  // ======================== Category bubble menu ========================

  private async loadCategories(): Promise<void> {
    try {
      this.categories = await this.productApi.loadCategories();
      this.cdr.markForCheck();
    } catch {
      this.categories = [];
    }
  }

  toggleBubbleMenu(): void {
    this.isBubbleMenuOpen = !this.isBubbleMenuOpen;
    this.cdr.markForCheck();
  }

  onShowAllClick(): void {
    this.isBubbleMenuOpen = false;
    this.activeCategory = null;
    this.lastSearchTerm = '';
    this.isLoading = true;
    this.cdr.markForCheck();
    this.loadFeaturedDisplay();
  }

  closeBubbleMenu(): void {
    this.isBubbleMenuOpen = false;
    this.cdr.markForCheck();
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
}
