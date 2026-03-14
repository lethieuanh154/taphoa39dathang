# TapHoa39DatHang - Trang dat hang online Song Minh

## Tong quan
Ung dung Angular standalone cho khach hang dat hang online. Mobile-first, UX don gian cho nguoi 30-70 tuoi.

## Tech Stack
- Angular 19 (standalone components)
- CSS thuan (khong Tailwind, khong UI library)
- REST API qua TapHoa39BackEnd
- Firestore `orders` collection (qua backend, khong truc tiep)

## Cau truc thu muc

```
src/app/
├── components/
│   ├── header/              # Thanh header co logo, search, cart icon
│   ├── product-card/        # Card san pham voi nut "Them"
│   ├── cart-panel/          # Slide panel gio hang tu ben phai
│   ├── checkout/            # Form dat hang (ten, SDT, dia chi, thanh toan)
│   └── order-confirm/       # Trang xac nhan dat hang thanh cong
├── home/                    # Trang chu (product grid + search)
├── models/
│   └── product.ts           # Product, CartItem, OrderData interfaces
├── services/
│   ├── cart.service.ts      # Quan ly gio hang (BehaviorSubject + localStorage)
│   ├── product-api.service.ts # Goi API tim kiem san pham
│   └── order-api.service.ts # Goi API dat hang
├── app.component.ts         # App shell (router-outlet)
├── app.routes.ts            # Routes config
└── app.config.ts            # App config
```

## Routes
| Path | Component | Mo ta |
|------|-----------|-------|
| `/` | HomeComponent | Trang chu, hien thi san pham |
| `/checkout` | CheckoutComponent (lazy) | Form dat hang |
| `/confirm/:orderId` | OrderConfirmComponent (lazy) | Xac nhan don hang |

## Flow dat hang
1. Khach tim san pham (search hoac quick tags)
2. Them vao gio bang nut "+" tren product card
3. Xem gio hang (slide panel tu ben phai)
4. Bam "Dat hang" → chuyen sang /checkout
5. Nhap thong tin: Ten, SDT, Dia chi
6. Chon thanh toan: COD (mac dinh) hoac QR chuyen khoan
7. Bam "Xac nhan dat hang" → POST /api/firebase/add_order
8. Chuyen sang /confirm/:orderId

## API Endpoints su dung
- `GET /api/item/{searchTerm}` - Tim kiem san pham (KiotViet)
- `POST /api/firebase/add_order` - Tao don hang moi

## Order Data Format
```json
{
  "id": "DH1710000000000",
  "customer": { "Name": "...", "ContactNumber": "...", "Address": "..." },
  "cartItems": [{ "product": {...}, "quantity": 1, "unitPriceSaleOff": 0 }],
  "totalPrice": 50000,
  "totalQuantity": 2,
  "discountAmount": 0,
  "customerPaid": 0,
  "status": "pending",
  "createdDate": "2026-03-14T...",
  "source": "online",
  "paymentMethod": "cod"
}
```

## Design Tokens (tu logo Song Minh)
- Green: `#2E7D32` (primary)
- Blue: `#1E88E5` (secondary)
- Orange: `#F57C00` (CTA buttons)
- Background: `#f5f5f5`
- Font: Be Vietnam Pro, min 16px
- Button min-height: 48px

## UX Guidelines
- Mobile first (grid 2 col mobile, 3-4 col desktop)
- Khong bat login truoc khi dat hang
- Luu thong tin khach hang vao localStorage de lan sau khong can nhap lai
- Gio hang luu localStorage de khong mat khi reload
- Quick search tags cho nguoi dung chon nhanh
- Slide panel cart (khong chuyen trang)
