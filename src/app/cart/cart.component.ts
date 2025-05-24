import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ManageCartService } from '../services/manage-cart.service';
import { Product } from '../models/product';

@Component({
    selector: 'app-cart',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './cart.component.html',
    styleUrls: ['./cart.component.css'],
})
export class CartComponent {
    cart: Product[] = [];

    constructor(private cartService: ManageCartService) {
        this.cart = this.cartService.getCart();
    }
    get getBill(): number {
        return this.cart.reduce((sum, item) => sum + (item.BasePrice || 0), 0);
    }
    remove(index: number) {
        this.cartService.removeFromCart(index);
    }

    close() {
        // Ẩn component này, bạn có thể dùng *ngIf ở cha hoặc service để điều khiển
    }
}