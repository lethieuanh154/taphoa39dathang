import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject, Subscription, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Product } from '../models/product';
import { IndexedDBService } from './indexed-db.service';
import { WebSocketService, ProductWSUpdate } from './websocket.service';

/**
 * ProductApiService - Manages product data for online ordering app.
 *
 * Architecture:
 * 1. Initial load: Firestore (via backend API) → IndexedDB
 * 2. Search: Local from IndexedDB (no API calls)
 * 3. Realtime: WebSocket updates → IndexedDB → UI
 * 4. Filter: ONLY original products (exclude clones)
 */
@Injectable({ providedIn: 'root' })
export class ProductApiService implements OnDestroy {
  private readonly DB_NAME = 'DatHangDB';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'products';
  private readonly LAST_SYNC_KEY = 'dh_lastProductSync';
  private readonly SEARCH_LIMIT = 80;

  private dbInitialized = false;
  private syncInProgress = false;
  private subs: Subscription[] = [];

  // In-memory cache for fast search
  private productsCache: Product[] | null = null;

  // Observable for UI to know when products are ready
  private productsReady$ = new BehaviorSubject<boolean>(false);
  private productUpdated$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private idb: IndexedDBService,
    private ws: WebSocketService
  ) {}

  /**
   * Initialize: load products + connect WebSocket.
   * Call this once from AppComponent or HomeComponent ngOnInit.
   */
  async initialize(): Promise<void> {
    await this.initDB();
    this.setupWebSocket();
    await this.syncProducts();
  }

  private async initDB(): Promise<void> {
    if (this.dbInitialized) return;
    await this.idb.init(this.DB_NAME, this.DB_VERSION, (db) => {
      if (!db.objectStoreNames.contains(this.STORE_NAME)) {
        const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'Id' });
        store.createIndex('Code', 'Code', { unique: false });
        store.createIndex('NormalizedName', 'NormalizedName', { unique: false });
      }
    });
    this.dbInitialized = true;
  }

  /**
   * Sync products from Firestore (via backend) into IndexedDB.
   * Uses modified-since for incremental sync after first load.
   */
  private async syncProducts(): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      const lastSync = localStorage.getItem(this.LAST_SYNC_KEY);
      const existingCount = await this.idb.count(this.DB_NAME, this.DB_VERSION, this.STORE_NAME);

      let products: Product[];

      if (!lastSync || existingCount === 0) {
        // Full sync: fetch all products
        const raw = await firstValueFrom(
          this.http.get<any[]>(`${environment.domainUrl}/api/firebase/get/products`)
        );
        products = this.filterOriginalProducts(raw || []);

        // Clear and re-populate
        await this.idb.clear(this.DB_NAME, this.DB_VERSION, this.STORE_NAME);
        if (products.length > 0) {
          await this.idb.putMany(this.DB_NAME, this.DB_VERSION, this.STORE_NAME, products);
        }
      } else {
        // Incremental sync: only fetch modified products
        const response = await firstValueFrom(
          this.http.post<{ products: any[]; count: number }>(
            `${environment.domainUrl}/api/firebase/products/modified-since`,
            { since: lastSync, include_inactive: true, include_deleted: false }
          )
        );
        products = this.filterOriginalProducts(response?.products || []);

        if (products.length > 0) {
          await this.idb.putMany(this.DB_NAME, this.DB_VERSION, this.STORE_NAME, products);
        }

        // Remove inactive/deleted products from IndexedDB
        const inactiveProducts = (response?.products || []).filter(
          (p: any) => p.isDeleted || !p.isActive
        );
        for (const p of inactiveProducts) {
          if (p.Id) {
            try {
              const existing = await this.idb.getByKey(this.DB_NAME, this.DB_VERSION, this.STORE_NAME, p.Id);
              if (existing) {
                await this.idb.put(this.DB_NAME, this.DB_VERSION, this.STORE_NAME, { ...existing, isDeleted: true, isActive: false });
              }
            } catch {}
          }
        }
      }

      localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
      this.invalidateCache();
      this.productsReady$.next(true);
    } catch (err) {
      console.error('[ProductApi] Sync failed:', err);
      // Still mark ready if we have cached data
      const count = await this.idb.count(this.DB_NAME, this.DB_VERSION, this.STORE_NAME).catch(() => 0);
      if (count > 0) {
        this.productsReady$.next(true);
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Setup WebSocket for realtime product updates.
   */
  private setupWebSocket(): void {
    this.ws.connect();

    this.subs.push(
      this.ws.getProductUpdates$().subscribe(updates => {
        this.handleProductUpdates(updates);
      }),
      this.ws.getProductsAdded$().subscribe(newProducts => {
        this.handleProductsAdded(newProducts);
      }),
      this.ws.getConnectionStatus$().subscribe(status => {
        if (status === 'connected') {
          // Re-sync on reconnect to catch missed updates
          this.syncProducts();
        }
      })
    );
  }

  /**
   * Handle realtime product updates from WebSocket.
   */
  private async handleProductUpdates(updates: ProductWSUpdate[]): Promise<void> {
    let changed = false;

    for (const update of updates) {
      const id = Number(update.Id);
      if (!id || isNaN(id)) continue;

      const existing = await this.idb.getByKey<Product>(
        this.DB_NAME, this.DB_VERSION, this.STORE_NAME, id
      );
      if (!existing) continue;

      // Skip clone products
      if (existing.isClone) continue;

      const merged = { ...existing };
      let hasChanges = false;

      const fields: (keyof ProductWSUpdate)[] = [
        'OnHand', 'OnHandNV', 'BasePrice', 'Cost', 'Name', 'FullName',
        'Description', 'NormalizedName', 'NormalizedCode', 'Code',
        'isActive', 'isDeleted'
      ];

      for (const field of fields) {
        if (update[field] !== undefined && update[field] !== (existing as any)[field]) {
          (merged as any)[field] = update[field];
          hasChanges = true;
        }
      }

      if (hasChanges) {
        if (update.ModifiedDate) merged.ModifiedDate = update.ModifiedDate;
        await this.idb.put(this.DB_NAME, this.DB_VERSION, this.STORE_NAME, merged);
        changed = true;
      }
    }

    if (changed) {
      this.invalidateCache();
      this.productUpdated$.next();
    }
  }

  /**
   * Handle new products added via WebSocket.
   */
  private async handleProductsAdded(newProducts: ProductWSUpdate[]): Promise<void> {
    let added = false;

    for (const raw of newProducts) {
      const id = Number(raw.Id);
      if (!id || isNaN(id)) continue;

      // Skip clones
      if (raw['isClone'] === true) continue;

      const existing = await this.idb.getByKey<Product>(
        this.DB_NAME, this.DB_VERSION, this.STORE_NAME, id
      );
      if (existing) continue;

      const product: Product = {
        Id: id,
        Code: raw.Code || '',
        Name: raw.Name || raw.FullName || '',
        FullName: raw.FullName || raw.Name || '',
        Image: raw['Image'] || null,
        BasePrice: Number(raw.BasePrice) || 0,
        Cost: Number(raw.Cost) || 0,
        OnHand: Number(raw.OnHand) || 0,
        OnHandNV: Number(raw.OnHandNV) || 0,
        Unit: raw['Unit'] || '',
        Description: raw.Description || '',
        CategoryId: raw['CategoryId'] ?? null,
        ConversionValue: Number(raw['ConversionValue']) || 0,
        MasterUnitId: raw['MasterUnitId'] ?? null,
        MasterProductId: raw['MasterProductId'] ?? null,
        NormalizedName: raw.NormalizedName || '',
        NormalizedCode: raw.NormalizedCode || '',
        isActive: raw.isActive !== false,
        isDeleted: raw.isDeleted === true,
        isClone: false,
        ModifiedDate: raw.ModifiedDate || new Date().toISOString(),
        ProductAttributes: raw['ProductAttributes'] || []
      };

      await this.idb.put(this.DB_NAME, this.DB_VERSION, this.STORE_NAME, product);
      added = true;
    }

    if (added) {
      this.invalidateCache();
      this.productUpdated$.next();
    }
  }

  /**
   * Search products locally from IndexedDB.
   * Returns filtered, active, non-clone products matching the search term.
   */
  async searchProducts(term: string): Promise<Product[]> {
    if (!term?.trim()) return [];

    const allProducts = await this.getCachedProducts();
    const normalized = this.normalize(term.toLowerCase());
    const tokens = normalized.split(/\s+/).filter(Boolean);

    const results: Product[] = [];

    for (const product of allProducts) {
      // Skip inactive/deleted
      if (product.isDeleted || !product.isActive) continue;

      // Skip clones
      if (this.isCloneProduct(product)) continue;

      // Match all tokens against product name/code
      const name = (product.NormalizedName || product.Name || product.FullName || '').toLowerCase();
      const code = (product.NormalizedCode || product.Code || '').toLowerCase();

      const matches = tokens.every(token =>
        name.includes(token) || code.includes(token)
      );

      if (matches) {
        results.push(product);
        if (results.length >= this.SEARCH_LIMIT) break;
      }
    }

    return results;
  }

  /**
   * Get product update observable for UI refresh.
   */
  getProductUpdated$() {
    return this.productUpdated$.asObservable();
  }

  /**
   * Get products ready observable.
   */
  getProductsReady$() {
    return this.productsReady$.asObservable();
  }

  /**
   * Get all cached products (active, non-clone) for discount bar etc.
   */
  async getAllCachedProducts(): Promise<Product[]> {
    const all = await this.getCachedProducts();
    return all.filter(p => !p.isDeleted && p.isActive && !this.isCloneProduct(p));
  }

  /**
   * Check if a product is a clone.
   * Uses same heuristics as BanHang:
   * 1. isClone === true
   * 2. OnHandNV > 0 && OnHand === 0 (fallback)
   */
  private isCloneProduct(product: Product): boolean {
    if (product.isClone === true) return true;
    if ((product.OnHandNV || 0) > 0 && product.OnHand === 0) return true;
    return false;
  }

  /**
   * Filter to only original (non-clone) products.
   */
  private filterOriginalProducts(raw: any[]): Product[] {
    if (!Array.isArray(raw)) return [];

    return raw
      .filter(item => {
        if (!item || !item.Id) return false;
        if (item.isDeleted) return false;
        if (item.isActive === false) return false;
        // Exclude clones
        if (item.isClone === true) return false;
        if ((item.OnHandNV || 0) > 0 && (item.OnHand || 0) === 0) return false;
        return true;
      })
      .map(item => this.mapProduct(item));
  }

  private mapProduct(item: any): Product {
    return {
      Id: Number(item.Id),
      Code: item.Code || '',
      Name: item.Name || item.FullName || '',
      FullName: item.FullName || item.Name || '',
      Image: item.Image || null,
      BasePrice: Number(item.BasePrice) || 0,
      Cost: Number(item.Cost) || 0,
      OnHand: Number(item.OnHand) || 0,
      OnHandNV: Number(item.OnHandNV) || 0,
      Unit: item.Unit || '',
      Description: item.Description ? String(item.Description).replace(/<\/?[^>]+(>|$)/g, '') : '',
      CategoryId: item.CategoryId ?? null,
      ConversionValue: Number(item.ConversionValue) || 0,
      MasterUnitId: item.MasterUnitId ?? null,
      MasterProductId: item.MasterProductId ?? null,
      NormalizedName: item.NormalizedName || '',
      NormalizedCode: item.NormalizedCode || '',
      isActive: item.isActive !== false,
      isDeleted: item.isDeleted === true,
      isClone: item.isClone === true,
      ModifiedDate: item.ModifiedDate || '',
      ProductAttributes: item.ProductAttributes || []
    };
  }

  private async getCachedProducts(): Promise<Product[]> {
    if (!this.productsCache) {
      this.productsCache = await this.idb.getAll<Product>(
        this.DB_NAME, this.DB_VERSION, this.STORE_NAME
      );
    }
    return this.productsCache;
  }

  private invalidateCache(): void {
    this.productsCache = null;
  }

  /**
   * Simple Vietnamese diacritics removal for search matching.
   */
  private normalize(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.ws.disconnect();
  }
}
