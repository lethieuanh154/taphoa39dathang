import { Injectable } from '@angular/core';
import * as product from '../models/product';

@Injectable({
  providedIn: 'root',
})
export class ProductService {

  protected productList: product.Product[] = [];

  getAllProducts(): product.Product[] {
    return this.productList;
  }

  getProductByCode(Code: any): product.Product | undefined {
    return this.productList.find((product) => product.Code === Code);
  }

  getProductByName(FullName: any): product.Product | undefined {
    return this.productList.find((product) => product.FullName === FullName);
  }
}
