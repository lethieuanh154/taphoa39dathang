import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../models/product';
import { RouterModule } from '@angular/router';
import { ManageCartService } from '../services/manage-cart.service';

@Component({
  selector: 'app-product-attributes',
  imports: [CommonModule, RouterModule],
  templateUrl: './product-attributes.html',
  styleUrls: ['./product-attributes.css']
})
export class ProductAttributes implements OnInit {
  @Input() product!: Product;
  constructor(private manageCartService: ManageCartService) { }

  ngOnInit() {
    const key = `discountBasePrice_${this.product.Code}`;
    const now = new Date();
    const day = now.getDay(); // 0: Chủ nhật, 1: Thứ 2, ...
    let discount = '';
    let storedProduct = localStorage.getItem(key);
    // Nếu chưa có hoặc đã sang tuần mới (thứ 2)
    let savedProduct = JSON.parse(storedProduct ? storedProduct : '{}');
    if (!storedProduct || day === 1 && new Date(savedProduct.lastUpdate ? savedProduct.lastUpdate : 0).getDate() !== now.getDate()) {
      discount = String(Math.floor(Math.random() * 16)); // 0-10
      const discountProduct: any = { discount: discount, lastUpdate: now.toISOString() };
      localStorage.setItem(key, JSON.stringify(discountProduct));
      this.product.discountBasePrice = Number(discount);
    } else {
      this.product.discountBasePrice = Number(savedProduct.discount);
    }
  }
  addToCart() {
    if (this.product.OnHand !== 0) {
      this.manageCartService.addToCart(this.product);
      // Có thể hiện thông báo hoặc hiệu ứng ở đây
    }
  }
}