import { Component, inject, NgZone, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ProductAttributes } from '../product/product-attributes';
import { Product } from '../models/product';
import * as productDataService from '../services/product-data.service';
import * as search from '../services/search.service';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { CartComponent } from '../cart/cart.component';

interface IWindow extends Window {
  webkitSpeechRecognition: any;
}

@Component({
  selector: 'app-home',
  imports: [
    CommonModule,
    ProductAttributes,
    FormsModule,
    HttpClientModule,
    MatIconModule,
    MatCardModule,
    MatToolbarModule,
    MatButtonModule,
    CartComponent
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.css'],
})
export class HomeComponent {
  productList: Product[] = [];
  searchTerm: string = '';
  productService: productDataService.ProductService = inject(productDataService.ProductService);
  searchService: search.SearchService = inject(search.SearchService);
  http: HttpClient = inject(HttpClient);
  recognition: any;

  constructor(
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.productList = this.productService.getAllProducts();
    if (isPlatformBrowser(this.platformId)) {

      const { webkitSpeechRecognition }: IWindow = <IWindow><unknown>window;
      this.recognition = new webkitSpeechRecognition();
      this.recognition.lang = 'vi-VN'; // hoặc 'en-US' nếu muốn tiếng Anh
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        this.ngZone.run(() => {
          this.searchTerm = transcript;
          setTimeout(() => {
            this.onSearch();
          }, 1000); // 1 giây sau khi nói xong sẽ thực hiện search
        });
      };

      this.recognition.onerror = (event: any) => {
        console.error('Lỗi khi nhận giọng nói:', event.error);
      };
    }
  }
  showCart = false;
  toggleCart() {
    this.showCart = !this.showCart;
  }
  startVoiceInput() {
    this.recognition.start();
  }

  onSearch() {

    this.searchService.onSearch(
      this.http,
      this.productList,
      false,
      this.searchTerm,
      (data: Product[]) => {
        this.productList = data;
      }
    );
  }
}