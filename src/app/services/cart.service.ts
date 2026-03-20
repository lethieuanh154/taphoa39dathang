import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Product, CartItem } from '../models/product';

@Injectable({ providedIn: 'root' })
export class CartService {
  private items: CartItem[] = [];
  private cartSubject = new BehaviorSubject<CartItem[]>([]);
  cart$ = this.cartSubject.asObservable();

  private panelOpenSubject = new BehaviorSubject<boolean>(false);
  panelOpen$ = this.panelOpenSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  getItems(): CartItem[] {
    return [...this.items];
  }

  getTotalItems(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getTotalPrice(): number {
    return this.items.reduce((sum, item) => {
      const price = item.product.BasePrice - (item.unitPriceSaleOff || 0);
      return sum + price * item.quantity;
    }, 0);
  }

  addToCart(product: Product, quantity = 1): void {
    const idx = this.items.findIndex(i => i.product.Code === product.Code);
    if (idx >= 0) {
      this.items = this.items.map((item, i) =>
        i === idx ? { ...item, quantity: item.quantity + quantity } : item
      );
    } else {
      this.items = [...this.items, { product, quantity, unitPriceSaleOff: 0 }];
    }
    this.emit();
  }

  updateQuantity(code: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(code);
      return;
    }
    this.items = this.items.map(item =>
      item.product.Code === code ? { ...item, quantity } : item
    );
    this.emit();
  }

  removeFromCart(code: string): void {
    this.items = this.items.filter(i => i.product.Code !== code);
    this.emit();
  }

  clearCart(): void {
    this.items = [];
    this.emit();
  }

  togglePanel(): void {
    this.panelOpenSubject.next(!this.panelOpenSubject.value);
  }

  closePanel(): void {
    this.panelOpenSubject.next(false);
  }

  openPanel(): void {
    this.panelOpenSubject.next(true);
  }

  private emit(): void {
    this.cartSubject.next([...this.items]);
    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('sm_cart', JSON.stringify(this.items));
    } catch {}
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('sm_cart');
      if (data) {
        this.items = JSON.parse(data);
        this.cartSubject.next([...this.items]);
      }
    } catch {}
  }
}
