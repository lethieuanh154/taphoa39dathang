import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { OrderData } from '../models/product';

@Injectable({ providedIn: 'root' })
export class OrderApiService {
  constructor(private http: HttpClient) {}

  submitOrder(order: OrderData): Observable<any> {
    return this.http.post(`${environment.domainUrl}/api/firebase/add_order`, order);
  }

  getOrderById(orderId: string): Observable<any> {
    return this.http.get(`${environment.domainUrl}/api/firebase/orders/${orderId}`);
  }
}
