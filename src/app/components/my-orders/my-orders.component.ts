import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { OrderApiService } from '../../services/order-api.service';
import { PolicyFooterComponent } from '../policy-footer/policy-footer.component';

export interface OrderItemInfo {
  name: string;
  qty: number;
  image?: string | null;
  price?: number;
}

export interface OrderHistoryEntry {
  orderId: string;
  createdDate: string;
  totalPrice: number;
  itemCount: number;
  wantDelivery: boolean;
  items: OrderItemInfo[];
  allItems?: OrderItemInfo[];
  liveStatus?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  checked: 'Hoàn thành',
  canceled: 'Đã hủy',
  edited: 'Đã sửa'
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9800',
  checked: '#4CAF50',
  canceled: '#9E9E9E',
  edited: '#2196F3'
};

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [CommonModule, RouterModule, PolicyFooterComponent],
  templateUrl: './my-orders.component.html',
  styleUrls: ['./my-orders.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyOrdersComponent implements OnInit {
  entries: OrderHistoryEntry[] = [];
  selectedOrder: OrderHistoryEntry | null = null;

  constructor(
    private orderApi: OrderApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    try {
      const raw = localStorage.getItem('sm_order_history');
      this.entries = raw ? JSON.parse(raw) : [];
    } catch {
      this.entries = [];
    }
    this.cdr.markForCheck();

    // Fetch fresh status for each order in background
    this.entries.forEach((entry, i) => {
      this.orderApi.getOrderById(entry.orderId).subscribe({
        next: (data: any) => {
          if (!data) return;
          const patch: Partial<OrderHistoryEntry> = {};
          if (data.status) patch.liveStatus = data.status;

          // Build full items list from cartItems
          if (data.cartItems?.length) {
            const allItems: OrderItemInfo[] = data.cartItems.map((ci: any) => ({
              name: ci.product?.Name || '',
              qty: ci.quantity || 0,
              image: ci.product?.Image || null,
              price: ci.unitPrice || (ci.product?.BasePrice - (ci.unitPriceSaleOff || 0)) || 0
            }));
            patch.allItems = allItems;
            patch.items = allItems.slice(0, 3);
            patch.itemCount = allItems.length;
          }

          this.entries = this.entries.map((e, j) =>
            j === i ? { ...e, ...patch } : e
          );
          this.cdr.markForCheck();
        },
        error: () => {}
      });
    });
  }

  statusLabel(status: string | undefined): string {
    return STATUS_LABELS[status || 'pending'] ?? 'Chờ xử lý';
  }

  statusColor(status: string | undefined): string {
    return STATUS_COLORS[status || 'pending'] ?? '#FF9800';
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min}`;
  }

  formatPrice(n: number): string {
    return n.toLocaleString('vi-VN');
  }

  openOrderDetail(entry: OrderHistoryEntry): void {
    this.selectedOrder = entry;
    this.cdr.markForCheck();
  }

  closeOrderDetail(): void {
    this.selectedOrder = null;
    this.cdr.markForCheck();
  }

  viewTracking(orderId: string): void {
    this.router.navigate(['/tracking', orderId]);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
