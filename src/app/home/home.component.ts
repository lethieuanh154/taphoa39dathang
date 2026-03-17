import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { HeaderComponent } from '../components/header/header.component';
import { ProductCardComponent } from '../components/product-card/product-card.component';
import { CartPanelComponent } from '../components/cart-panel/cart-panel.component';
import { ProductDetailComponent } from '../components/product-detail/product-detail.component';
import { CustomerIdentityDialogComponent } from '../components/customer-identity-dialog/customer-identity-dialog.component';
import { ChatBubbleComponent } from '../components/chat-bubble/chat-bubble.component';
import { DraggableBubbleDirective } from '../directives/draggable-bubble.directive';
import { ProductApiService } from '../services/product-api.service';
import { GroupService } from '../services/group.service';
import { Product } from '../models/product';

interface Category {
  Id: number;
  Name: string;
  Path: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, HeaderComponent, ProductCardComponent, CartPanelComponent, ProductDetailComponent, CustomerIdentityDialogComponent, ChatBubbleComponent, DraggableBubbleDirective] as const,
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

  // Discount bar - random 10 products, reset daily
  discountProducts: Product[] = [];

  // Customer identity
  showIdentityDialog = false;
  customerIdentity: string | null = null;

  // Category bubble menu
  categories: Category[] = [];
  isBubbleMenuOpen = false;
  activeCategory: Category | null = null;

  private readonly PAGE_SIZE = 20;
  private lastSearchTerm = '';
  private updateSub?: Subscription;

  constructor(
    private productApi: ProductApiService,
    private groupService: GroupService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Check customer identity
    this.customerIdentity = CustomerIdentityDialogComponent.getStoredIdentity();
    if (!this.customerIdentity) {
      this.showIdentityDialog = true;
      return; // Don't load products until identity is confirmed
    }

    this.initProducts();
  }

  onIdentityConfirmed(identity: string): void {
    this.customerIdentity = identity;
    this.showIdentityDialog = false;
    this.cdr.markForCheck();
    this.initProducts();
  }

  private initProducts(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.productApi.initialize().then(() => {
      // Load categories after DB is initialized to avoid race condition
      this.loadCategories();
      // Show featured products on initial load (no search needed)
      this.loadFeaturedDisplay();
      this.loadDiscountProducts();
    });

    this.updateSub = this.productApi.getProductUpdated$().subscribe(() => {
      // Just refresh discount products on WS update (don't reload main grid to preserve scroll)
      this.refreshDiscountProducts();
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
    this.cdr.markForCheck();
  }

  // ======================== Discount bar ========================

  private async loadDiscountProducts(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = 'dh_discountProducts';
    const cacheDateKey = 'dh_discountDate';

    const cachedDate = localStorage.getItem(cacheDateKey);
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedDate === today && cachedData) {
      try {
        const codes: string[] = JSON.parse(cachedData);
        const allProducts = await this.productApi.getAllCachedProducts();
        this.discountProducts = codes
          .map(code => allProducts.find(p => p.Code === code))
          .filter((p): p is Product => !!p);
        this.cdr.markForCheck();
        return;
      } catch { /* fall through to regenerate */ }
    }

    const allProducts = await this.productApi.getAllCachedProducts();
    if (allProducts.length === 0) return;

    const shuffled = this.seededShuffle([...allProducts], today);
    this.discountProducts = shuffled.slice(0, 10);

    localStorage.setItem(cacheDateKey, today);
    localStorage.setItem(cacheKey, JSON.stringify(this.discountProducts.map(p => p.Code)));
    this.cdr.markForCheck();
  }

  private seededShuffle(arr: Product[], seed: string): Product[] {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    for (let i = arr.length - 1; i > 0; i--) {
      hash = (hash * 16807 + 12345) & 0x7fffffff;
      const j = hash % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Refresh discount products with latest data from IndexedDB (after WS update).
   * Keeps the same product codes, just updates prices/stock.
   */
  private async refreshDiscountProducts(): Promise<void> {
    if (this.discountProducts.length === 0) return;
    const codes = this.discountProducts.map(p => p.Code);
    const allProducts = await this.productApi.getAllCachedProducts();
    this.discountProducts = codes
      .map(code => allProducts.find(p => p.Code === code))
      .filter((p): p is Product => !!p);
    this.cdr.markForCheck();
  }

  onDiscountProductClick(product: Product): void {
    this.onProductClick(product, true);
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
  getOriginalPrice(basePrice: number): number {
    return Math.round((basePrice * 1.05) / 500) * 500;
  }
  trackByProductCode(_: number, product: Product): string {
    return product.Code;
  }

  trackByCategoryId(_: number, cat: Category): number {
    return cat.Id;
  }
}
