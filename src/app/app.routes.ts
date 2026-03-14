import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';

const routeConfig: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'Song Minh - Đặt hàng'
  },
  {
    path: 'checkout',
    loadComponent: () => import('./components/checkout/checkout.component').then(m => m.CheckoutComponent),
    title: 'Song Minh - Thanh toán'
  },
  {
    path: 'confirm/:orderId',
    loadComponent: () => import('./components/order-confirm/order-confirm.component').then(m => m.OrderConfirmComponent),
    title: 'Song Minh - Xác nhận đơn hàng'
  },
  {
    path: '**',
    redirectTo: ''
  }
];

export default routeConfig;
