import { Component, EventEmitter, Output, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent implements OnDestroy {
  searchTerm = '';
  showAbout = false;
  @Output() search = new EventEmitter<string>();

  totalItems = 0;
  private cartSub: Subscription;

  constructor(private cartService: CartService, private cdr: ChangeDetectorRef) {
    this.cartSub = this.cartService.cart$.subscribe(() => {
      this.totalItems = this.cartService.getTotalItems();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.cartSub.unsubscribe();
  }

  onSearch(): void {
    this.search.emit(this.searchTerm.trim());
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.onSearch();
    }
  }

  toggleCart(): void {
    this.cartService.togglePanel();
  }
}
