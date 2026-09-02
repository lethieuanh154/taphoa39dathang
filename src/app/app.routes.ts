import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';

const routeConfig: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'Song Minh - Đặt hàng'
  },
  {
    path: 'khuyen-mai',
    loadComponent: () => import('./components/promotion-page/promotion-page.component').then(m => m.PromotionPageComponent),
    title: 'Song Minh - Khuyến mại'
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
    path: 'gioi-thieu',
    loadComponent: () => import('./components/policy/gioi-thieu/gioi-thieu.component').then(m => m.GioiThieuComponent),
    title: 'Song Minh - Giới thiệu'
  },
  {
    path: 'huong-dan-mua-hang',
    loadComponent: () => import('./components/policy/huong-dan-mua-hang/huong-dan-mua-hang.component').then(m => m.HuongDanMuaHangComponent),
    title: 'Song Minh - Hướng dẫn mua hàng'
  },
  {
    path: 'chinh-sach-doi-tra',
    loadComponent: () => import('./components/policy/chinh-sach-doi-tra/chinh-sach-doi-tra.component').then(m => m.ChinhSachDoiTraComponent),
    title: 'Song Minh - Chính sách đổi trả'
  },
  {
    path: 'chinh-sach-van-chuyen',
    loadComponent: () => import('./components/policy/chinh-sach-van-chuyen/chinh-sach-van-chuyen.component').then(m => m.ChinhSachVanChuyenComponent),
    title: 'Song Minh - Chính sách vận chuyển'
  },
  {
    path: 'phuong-thuc-thanh-toan',
    loadComponent: () => import('./components/policy/phuong-thuc-thanh-toan/phuong-thuc-thanh-toan.component').then(m => m.PhuongThucThanhToanComponent),
    title: 'Song Minh - Phương thức thanh toán'
  },
  {
    path: 'chinh-sach-bao-mat',
    loadComponent: () => import('./components/policy/chinh-sach-bao-mat/chinh-sach-bao-mat.component').then(m => m.ChinhSachBaoMatComponent),
    title: 'Song Minh - Chính sách bảo mật'
  },
  {
    path: 'dieu-khoan-su-dung',
    loadComponent: () => import('./components/policy/dieu-khoan-su-dung/dieu-khoan-su-dung.component').then(m => m.DieuKhoanSuDungComponent),
    title: 'Song Minh - Điều khoản sử dụng'
  },
  {
    path: 'don-hang-cua-toi',
    loadComponent: () => import('./components/my-orders/my-orders.component').then(m => m.MyOrdersComponent),
    title: 'Song Minh - Đơn hàng của tôi'
  },
  {
    path: 'tracking/:orderId',
    loadComponent: () => import('./components/order-tracking/order-tracking.component').then(m => m.OrderTrackingComponent),
    title: 'Song Minh - Theo dõi đơn hàng'
  },
  {
    path: '**',
    redirectTo: ''
  }
];

export default routeConfig;
