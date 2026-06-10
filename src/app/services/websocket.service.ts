import { Injectable, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ProductWSUpdate {
  Id: number;
  OnHand?: number;
  OnHandNV?: number;
  BasePrice?: number;
  Cost?: number;
  Code?: string;
  Name?: string;
  FullName?: string;
  Description?: string;
  NormalizedName?: string;
  NormalizedCode?: string;
  ModifiedDate?: string;
  isActive?: boolean;
  isDeleted?: boolean;
  [key: string]: any;
}

export interface ProductsUpdatedPayload {
  products: ProductWSUpdate[];
  timestamp: string;
  count: number;
}

export interface PromotionsUpdatedPayload {
  action: 'created' | 'updated' | 'deleted' | 'toggled';
  promotionId?: string;
}

export interface BonusUpdatedPayload {
  code: string;
  giftPoint: number;
  bonusAdded: number;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private socket: any = null;
  private customerSocket: any = null;

  private productUpdates$ = new Subject<ProductWSUpdate[]>();
  private productsAdded$ = new Subject<ProductWSUpdate[]>();
  private promotionsUpdated$ = new Subject<PromotionsUpdatedPayload>();
  private bonusUpdated$ = new Subject<BonusUpdatedPayload>();
  private connectionStatus$ = new BehaviorSubject<'connected' | 'disconnected' | 'connecting'>('disconnected');

  private async loadIO(): Promise<typeof import('socket.io-client')['io']> {
    const mod = await import('socket.io-client');
    return mod.io;
  }

  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    this.connectionStatus$.next('connecting');
    const io = await this.loadIO();

    this.socket = io(`${environment.domainUrl}/api/websocket/products`, {
      transports: ['polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      this.connectionStatus$.next('connected');
    });

    this.socket.on('disconnect', () => {
      this.connectionStatus$.next('disconnected');
    });

    this.socket.on('connect_error', (err: any) => {
      console.warn('[WS] Connection error:', err.message);
    });

    this.socket.on('products_updated', (payload: ProductsUpdatedPayload) => {
      if (payload?.products?.length) {
        this.productUpdates$.next(payload.products);
      }
    });

    this.socket.on('products_added', (payload: ProductsUpdatedPayload) => {
      if (payload?.products?.length) {
        this.productsAdded$.next(payload.products);
      }
    });

    this.socket.on('promotions_updated', (payload: PromotionsUpdatedPayload) => {
      this.promotionsUpdated$.next(payload);
    });

    this.socket.on('notify', (payload: any) => {
      if (payload?.products?.length) {
        this.productUpdates$.next(payload.products);
      }
    });

    this.connectCustomer();
  }

  /** Connect to customer namespace (bonus updates). Safe to call multiple times. */
  async connectCustomer(): Promise<void> {
    if (this.customerSocket?.connected) return;

    const io = await this.loadIO();

    this.customerSocket = io(`${environment.domainUrl}/api/websocket/customers`, {
      transports: ['polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000
    });

    this.customerSocket.on('connect', () => {
      console.log('[WS-Customer] Connected to /api/websocket/customers');
    });

    this.customerSocket.on('connect_error', (err: any) => {
      console.warn('[WS-Customer] Connection error:', err.message);
    });

    this.customerSocket.on('bonus_updated', (payload: BonusUpdatedPayload) => {
      console.log('[WS-Customer] bonus_updated received:', payload);
      if (payload?.code) {
        const myCode = localStorage.getItem('sm_customer_identity') || '';
        console.log('[WS-Customer] myCode:', myCode, 'payload.code:', payload.code);
        if (myCode && myCode === payload.code) {
          localStorage.setItem('sm_customer_giftpoint', String(payload.giftPoint));
          this.bonusUpdated$.next(payload);
          console.log('[WS-Customer] giftPoint updated to', payload.giftPoint);
        }
      }
    });
  }

  getProductUpdates$() {
    return this.productUpdates$.asObservable();
  }

  getProductsAdded$() {
    return this.productsAdded$.asObservable();
  }

  getPromotionsUpdated$() {
    return this.promotionsUpdated$.asObservable();
  }

  getBonusUpdated$() {
    return this.bonusUpdated$.asObservable();
  }

  getConnectionStatus$() {
    return this.connectionStatus$.asObservable();
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.customerSocket?.disconnect();
    this.customerSocket = null;
    this.connectionStatus$.next('disconnected');
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.productUpdates$.complete();
    this.productsAdded$.complete();
    this.promotionsUpdated$.complete();
    this.bonusUpdated$.complete();
    this.connectionStatus$.complete();
  }
}
