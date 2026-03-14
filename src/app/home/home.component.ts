import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription, firstValueFrom } from 'rxjs';
import { HeaderComponent } from '../components/header/header.component';
import { ProductCardComponent } from '../components/product-card/product-card.component';
import { CartPanelComponent } from '../components/cart-panel/cart-panel.component';
import { ProductDetailComponent } from '../components/product-detail/product-detail.component';
import { ProductApiService } from '../services/product-api.service';
import { GroupService } from '../services/group.service';
import { Product } from '../models/product';
import { environment } from '../../environments/environment';

interface Category {
  Id: number;
  Name: string;
  Path: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, HeaderComponent, ProductCardComponent, CartPanelComponent, ProductDetailComponent] as const,
  templateUrl: './home.component.html',
  styleUrls: ['./home.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, OnDestroy {

  // All master products from search (after grouping)
  private allMasterProducts: Product[] = [];
  // Displayed subset for infinite scroll
  displayedProducts: Product[] = [];
  // Grouped products map for unit switching in detail dialog
  groupedProducts: Record<number, Product[]> = {};

  isLoading = false;
  isLoadingMore = false;
  hasSearched = false;
  footerHidden = false;

  // Product detail dialog
  detailProduct: Product | null = null;
  detailGroup: Product[] = [];

  // Discount bar - random 10 products, reset daily
  discountProducts: Product[] = [];

  // Category bubble menu
  categories: Category[] = [];
  isBubbleMenuOpen = false;

  private readonly PAGE_SIZE = 20;
  private loadedCount = 0;
  private lastScrollY = 0;
  private lastSearchTerm = '';
  private updateSub?: Subscription;

  constructor(
    private productApi: ProductApiService,
    private groupService: GroupService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.productApi.initialize().then(() => {
      this.onSearch('nuoc');
      this.loadDiscountProducts();
    });

    this.loadCategories();

    this.updateSub = this.productApi.getProductUpdated$().subscribe(() => {
      if (this.lastSearchTerm) {
        this.doSearch(this.lastSearchTerm);
      }
    });
  }

  ngOnDestroy(): void {
    this.updateSub?.unsubscribe();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const scrollY = window.scrollY;

    // Footer: hide on scroll down, show on scroll up
    if (scrollY > this.lastScrollY && scrollY > 100) {
      this.footerHidden = true;
    } else {
      this.footerHidden = false;
    }
    this.lastScrollY = scrollY;

    // Infinite scroll: load more when near bottom
    const scrollPosition = window.innerHeight + scrollY;
    const docHeight = document.documentElement.scrollHeight;

    if (scrollPosition >= docHeight - 200 && !this.isLoadingMore && this.loadedCount < this.allMasterProducts.length) {
      this.loadMore();
    }

    this.cdr.markForCheck();
  }

  onSearch(term: string): void {
    if (!term.trim()) {
      term = 'nuoc';
    }
    this.lastSearchTerm = term;
    this.isLoading = true;
    this.hasSearched = true;
    this.cdr.markForCheck();
    this.doSearch(term);
  }

  private async doSearch(term: string): Promise<void> {
    try {
      const results = await this.productApi.searchProducts(term);

      // Group by MasterUnit
      this.groupedProducts = this.groupService.group(results);

      // Extract master products (first in each group)
      this.allMasterProducts = Object.values(this.groupedProducts).map(group => group[0]);

      // Reset pagination
      this.loadedCount = Math.min(this.PAGE_SIZE, this.allMasterProducts.length);
      this.displayedProducts = this.allMasterProducts.slice(0, this.loadedCount);
    } catch {
      this.allMasterProducts = [];
      this.displayedProducts = [];
      this.groupedProducts = {};
    }
    this.isLoading = false;
    this.cdr.markForCheck();
  }

  private loadMore(): void {
    this.isLoadingMore = true;
    this.cdr.markForCheck();

    // Small delay to show spinner
    setTimeout(() => {
      const nextCount = Math.min(this.loadedCount + this.PAGE_SIZE, this.allMasterProducts.length);
      this.displayedProducts = this.allMasterProducts.slice(0, nextCount);
      this.loadedCount = nextCount;
      this.isLoadingMore = false;
      this.cdr.markForCheck();
    }, 100);
  }

  onProductClick(product: Product): void {
    const masterId = product.MasterUnitId === null || product.MasterUnitId === undefined
      ? product.Id
      : (Number(product.MasterUnitId) === product.Id ? product.Id : Number(product.MasterUnitId));

    this.detailGroup = this.groupedProducts[masterId] || [product];
    this.detailProduct = product;
    this.cdr.markForCheck();
  }

  onDetailClose(): void {
    this.detailProduct = null;
    this.detailGroup = [];
    this.cdr.markForCheck();
  }

  // --- Discount bar: random 10 products, reset daily ---
  private async loadDiscountProducts(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
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

    // Generate new random 10
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

  onDiscountProductClick(product: Product): void {
    this.onProductClick(product);
  }

  // --- Category bubble menu ---
  private async loadCategories(): Promise<void> {
    try {
      const url = `${environment.domainUrl}/api/kiotviet/categories`;
      this.categories = await firstValueFrom(this.http.get<Category[]>(url));
      this.cdr.markForCheck();
    } catch {
      this.categories = [];
    }
  }

  toggleBubbleMenu(): void {
    this.isBubbleMenuOpen = !this.isBubbleMenuOpen;
    this.cdr.markForCheck();
  }

  closeBubbleMenu(): void {
    this.isBubbleMenuOpen = false;
    this.cdr.markForCheck();
  }

  onCategoryClick(category: Category): void {
    this.isBubbleMenuOpen = false;
    this.onSearch(category.Name);
  }

  trackByProductCode(_: number, product: Product): string {
    return product.Code;
  }

  trackByCategoryId(_: number, cat: Category): number {
    return cat.Id;
  }
}
