import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject, Subscription, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Product } from '../models/product';
import { IndexedDBService } from './indexed-db.service';
import { WebSocketService, ProductWSUpdate } from './websocket.service';

interface Category {
  Id: number;
  Name: string;
  Path: string;
}

/**
 * ProductApiService - Hybrid architecture for DatHang app.
 *
 * Architecture:
 * 1. Initial load: Featured products (50) + Categories (~5KB total)
 * 2. Category click: Load products by category from API → cache in IndexedDB
 * 3. Search: Server-side search API (no full DB load needed)
 * 4. Realtime: WebSocket updates for products already in IndexedDB
 * 5. Filter: ONLY original products (exclude clones)
 */
@Injectable({ providedIn: 'root' })
export class ProductApiService implements OnDestroy {
  private readonly DB_NAME = 'DatHangDB';
  private readonly DB_VERSION = 2; // Bumped from 1 to add CategoryId index
  private readonly STORE_NAME = 'products';
  private readonly META_STORE = 'metadata';
  private readonly SEARCH_LIMIT = 80;

  private dbInitialized = false;
  private subs: Subscription[] = [];

  // In-memory cache for local operations
  private productsCache: Product[] | null = null;

  // Observable for UI
  private productsReady$ = new BehaviorSubject<boolean>(false);
  private productUpdated$ = new Subject<void>();

  // Categories cache
  private categories: Category[] = [];

  constructor(
    private http: HttpClient,
    private idb: IndexedDBService,
    private ws: WebSocketService
  ) {}

  /**
   * Initialize: setup DB + WebSocket + load featured products.
   * NO full product sync — only ~50KB initial payload.
   */
  async initialize(): Promise<void> {
    await this.initDB();
    this.setupWebSocket();
    await this.loadFeaturedProducts();
  }

  private async initDB(): Promise<void> {
    if (this.dbInitialized) return;
    await this.idb.init(this.DB_NAME, this.DB_VERSION, (db, oldVersion) => {
      // Version 1 -> 2: Add CategoryId index + metadata store
      if (oldVersion < 1) {
        const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'Id' });
        store.createIndex('Code', 'Code', { unique: false });
        store.createIndex('NormalizedName', 'NormalizedName', { unique: false });
        store.createIndex('CategoryId', 'CategoryId', { unique: false });
      }
      if (oldVersion < 2) {
        // Add CategoryId index to existing store if upgrading from v1
        if (oldVersion >= 1) {
          const tx = (db as any).transaction;
          if (tx) {
            try {
              const store = tx.objectStore(this.STORE_NAME);
              if (!store.indexNames.contains('CategoryId')) {
                store.createIndex('CategoryId', 'CategoryId', { unique: false });
              }
            } catch {
              // If store access fails during upgrade, recreate
              db.deleteObjectStore(this.STORE_NAME);
              const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'Id' });
              store.createIndex('Code', 'Code', { unique: false });
              store.createIndex('NormalizedName', 'NormalizedName', { unique: false });
              store.createIndex('CategoryId', 'CategoryId', { unique: false });
            }
          }
        }
        if (!db.objectStoreNames.contains(this.META_STORE)) {
          db.createObjectStore(this.META_STORE, { keyPath: 'key' });
        }
      }
    });
    this.dbInitialized = true;
  }

  /**
   * Load featured products (newest 50). Fast initial page render.
   */
  private async loadFeaturedProducts(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ products: any[]; count: number }>(
          `${environment.domainUrl}/api/firebase/products/featured?limit=50`
        )
      );
      const products = this.filterOriginalProducts(response?.products || []);

      if (products.length > 0) {
        await this.idb.putMany(this.DB_NAME, this.DB_VERSION, this.STORE_NAME, products);
      }

      this.invalidateCache();
      this.productsReady$.next(true);
    } catch (err) {
      console.error('[ProductApi] Featured products load failed:', err);
      // Still mark ready if we have cached data from previous session
      const count = await this.idb.count(this.DB_NAME, this.DB_VERSION, this.STORE_NAME).catch(() => 0);
      if (count > 0) {
        this.productsReady$.next(true);
      }
    }
  }

  /**
   * Load products by category from API → store in IndexedDB.
   * Returns products for immediate display.
   */
  async loadByCategory(categoryId: number): Promise<Product[]> {
    // Check IndexedDB first
    const cached = await this.idb.getAllByIndex<Product>(
      this.DB_NAME, this.DB_VERSION, this.STORE_NAME, 'CategoryId', categoryId
    );

    // Check if we recently synced this category
    const metaKey = `cat_sync_${categoryId}`;
    const meta = await this.idb.getByKey<{ key: string; timestamp: string }>(
      this.DB_NAME, this.DB_VERSION, this.META_STORE, metaKey
    ).catch(() => undefined);

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const isStale = !meta || meta.timestamp < fiveMinAgo;

    if (cached.length > 0 && !isStale) {
      // Return cached, but no background refresh needed
      return cached.filter(p => !p.isDeleted && p.isActive && !this.isCloneProduct(p));
    }

    // Fetch from API
    try {
      const response = await firstValueFrom(
        this.http.get<{ products: any[]; count: number }>(
          `${environment.domainUrl}/api/firebase/get/products/by-category/${categoryId}`
        )
      );
      const products = this.filterOriginalProducts(response?.products || []);

      if (products.length > 0) {
        await this.idb.putMany(this.DB_NAME, this.DB_VERSION, this.STORE_NAME, products);
      }

      // Save sync timestamp
      await this.idb.put(this.DB_NAME, this.DB_VERSION, this.META_STORE, {
        key: metaKey, timestamp: new Date().toISOString()
      });

      this.invalidateCache();
      this.productUpdated$.next();
      return products;
    } catch (err) {
      console.error(`[ProductApi] Load category ${categoryId} failed:`, err);
      // Return whatever we have cached
      return cached.filter(p => !p.isDeleted && p.isActive && !this.isCloneProduct(p));
    }
  }

  /**
   * Search products via server-side API.
   * Falls back to local IndexedDB search if API fails.
   */
  async searchProducts(term: string): Promise<Product[]> {
    if (!term?.trim()) return [];

    // Try server-side search first
    try {
      const response = await firstValueFrom(
        this.http.get<{ products: any[]; count: number }>(
          `${environment.domainUrl}/api/firebase/products/search`,
          { params: { q: term.trim(), limit: String(this.SEARCH_LIMIT) } }
        )
      );
      const products = this.filterOriginalProducts(response?.products || []);

      // Cache search results in IndexedDB for offline use
      if (products.length > 0) {
        await this.idb.putMany(this.DB_NAME, this.DB_VERSION, this.STORE_NAME, products);
        this.invalidateCache();
      }

      return products;
    } catch (err) {
      console.warn('[ProductApi] Server search failed, falling back to local:', err);
      return this.searchLocal(term);
    }
  }

  /**
   * Local search from IndexedDB (fallback when offline).
   */
  private async searchLocal(term: string): Promise<Product[]> {
    const allProducts = await this.getCachedProducts();
    const normalized = this.normalize(term.toLowerCase());
    const tokens = normalized.split(/\s+/).filter(Boolean);

    const results: Product[] = [];

    for (const product of allProducts) {
      if (product.isDeleted || !product.isActive) continue;
      if (this.isCloneProduct(product)) continue;

      const name = (product.NormalizedName || product.Name || product.FullName || '').toLowerCase();
      const code = (product.NormalizedCode || product.Code || '').toLowerCase();

      if (tokens.every(token => name.includes(token) || code.includes(token))) {
        results.push(product);
        if (results.length >= this.SEARCH_LIMIT) break;
      }
    }

    return results;
  }

  // ======================== WebSocket ========================

  private setupWebSocket(): void {
    this.ws.connect();

    this.subs.push(
      this.ws.getProductUpdates$().subscribe(updates => {
        this.handleProductUpdates(updates);
      }),
      this.ws.getProductsAdded$().subscribe(newProducts => {
        this.handleProductsAdded(newProducts);
      })
    );
  }

  /**
   * Handle realtime product updates — only update products already in IndexedDB.
   */
  private async handleProductUpdates(updates: ProductWSUpdate[]): Promise<void> {
    let changed = false;

    for (const update of updates) {
      const id = Number(update.Id);
      if (!id || isNaN(id)) continue;

      const existing = await this.idb.getByKey<Product>(
        this.DB_NAME, this.DB_VERSION, this.STORE_NAME, id
      );
      if (!existing) continue; // Not in our local DB — skip

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

  private async handleProductsAdded(newProducts: ProductWSUpdate[]): Promise<void> {
    let added = false;

    for (const raw of newProducts) {
      const id = Number(raw.Id);
      if (!id || isNaN(id)) continue;
      if (raw['isClone'] === true) continue;

      const existing = await this.idb.getByKey<Product>(
        this.DB_NAME, this.DB_VERSION, this.STORE_NAME, id
      );
      if (existing) continue;

      const product: Product = this.mapProduct(raw);
      await this.idb.put(this.DB_NAME, this.DB_VERSION, this.STORE_NAME, product);
      added = true;
    }

    if (added) {
      this.invalidateCache();
      this.productUpdated$.next();
    }
  }

  // ======================== Observables ========================

  getProductUpdated$() {
    return this.productUpdated$.asObservable();
  }

  getProductsReady$() {
    return this.productsReady$.asObservable();
  }

  /**
   * Get all cached products (active, non-clone) from IndexedDB.
   * Used for discount bar etc.
   */
  async getAllCachedProducts(): Promise<Product[]> {
    const all = await this.getCachedProducts();
    return all.filter(p => !p.isDeleted && p.isActive && !this.isCloneProduct(p));
  }

  // ======================== Helpers ========================

  private isCloneProduct(product: Product): boolean {
    if (product.isClone === true) return true;
    if ((product.OnHandNV || 0) > 0 && product.OnHand === 0) return true;
    return false;
  }

  private filterOriginalProducts(raw: any[]): Product[] {
    if (!Array.isArray(raw)) return [];

    return raw
      .filter(item => {
        if (!item || !item.Id) return false;
        if (item.isDeleted) return false;
        if (item.isActive === false) return false;
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
      CategoryName: item.CategoryName || undefined,
      ConversionValue: Number(item.ConversionValue) || 0,
      MasterUnitId: item.MasterUnitId ?? null,
      MasterProductId: item.MasterProductId ?? null,
      NormalizedName: item.NormalizedName || '',
      NormalizedCode: item.NormalizedCode || '',
      isActive: item.isActive !== false,
      isDeleted: item.isDeleted === true,
      isClone: item.isClone === true,
      CloneOnHandNV: Number(item.CloneOnHandNV) || 0,
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

  private normalize(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.ws.disconnect();
  }
}
