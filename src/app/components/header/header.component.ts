import { Component, EventEmitter, Output, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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

  openAbout(): void {
    this.showAbout = true;
    history.pushState({ modal: 'about' }, '');
  }

  closeAbout(): void {
    if (this.showAbout) {
      this.showAbout = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:popstate', ['$event'])
  onPopState(event: PopStateEvent): void {
    if (this.showAbout) {
      this.closeAbout();
    }
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
