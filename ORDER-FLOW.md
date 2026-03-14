# Order Flow - TapHoa39 System

## Tổng quan

Hệ thống đặt hàng gồm 3 phần chính:

```
TapHoa39DatHang (Customer)  →  TapHoa39BackEnd (API)  →  TapHoa39BanHang (POS/Staff)
     [Đặt hàng online]         [Firestore orders]          [Nhận & xử lý đơn]
```

## 1. Luồng đặt hàng (Customer → Backend)

### 1.1 TapHoa39DatHang (Frontend khách hàng)
- **Trang chủ**: Hiển thị sản phẩm, tìm kiếm, thêm vào giỏ
- **Giỏ hàng**: Slide panel, tăng/giảm số lượng
- **Checkout**: Form đơn giản (Tên, SĐT, Địa chỉ)
- **Thanh toán**: COD mặc định, hỗ trợ QR chuyển khoản
- **Xác nhận**: Hiển thị thông tin đơn hàng đã đặt

### 1.2 API Endpoint
```
POST /api/firebase/add_order
Body: {
  id: string,              // "DH" + timestamp
  customer: {
    Name: string,          // Tên khách hàng
    ContactNumber: string, // Số điện thoại
    Address: string        // Địa chỉ giao hàng
  },
  cartItems: [{
    product: {
      Name: string,
      Code: string,
      BasePrice: number,
      Image: string,
      Unit: string
    },
    quantity: number,
    unitPriceSaleOff: number
  }],
  totalPrice: number,
  totalQuantity: number,
  discountAmount: number,
  customerPaid: number,
  totalCost: number,
  note: string,
  status: "pending",       // Trạng thái ban đầu
  createdDate: string,     // ISO string Vietnam timezone
  deliveryTime: string,    // Thời gian giao hàng mong muốn
  source: "online"         // Nguồn đặt hàng (online vs POS)
}
```

### 1.3 Backend xử lý
- File: `TapHoa39BackEnd/routes/firebase_orders.py`
- Service: `TapHoa39BackEnd/firebase/firebase_service/order_service.py`
- Firestore: Project `taphoa39hoadon1`, Collection `orders`
- Service Account: `FIREBASE_SERVICE_ACCOUNT_HOADON`
- Sau khi lưu → emit WebSocket event `order_created` trên namespace `/api/websocket/orders`

## 2. Luồng nhận đơn (Backend → POS)

### 2.1 OrderService (Frontend POS)
- File: `TapHoa39BanHang/src/app/services/order.service.ts`
- Lưu cache vào IndexedDB (DB: `Orders`, store: `order`)
- Sync: Firestore → IndexedDB khi load trang
- Real-time events qua Subject: `orderCreated$`, `orderUpdated$`, `orderDeleted$`

### 2.2 Order Page
- File: `TapHoa39BanHang/src/app/components/order-page/order-page.component.ts`
- Hiển thị danh sách đơn hàng dạng bảng (Material Table)
- Filter: theo ngày, khách hàng, mã đơn, tên sản phẩm
- Actions: Xem chi tiết, In, Hủy đơn
- Mở trong MatDialog

### 2.3 View Selected Order
- File: `TapHoa39BanHang/src/app/components/order-page/view-selected-order.component.ts`
- Hiển thị chi tiết đơn hàng
- Actions:
  - **Xử lý đơn** (`handleOrder()`): Tạo Invoice từ Order → emit qua `OrderToInvoiceService` → đóng dialog
  - **Chỉnh sửa** (`editOrder()`): Gửi order về main-page để chỉnh sửa
  - **Xóa** (`deleteOrder()`): Xóa khỏi IndexedDB + Firestore

### 2.4 Order → Invoice Flow
- File: `TapHoa39BanHang/src/app/services/order-to-invoice.service.ts`
- `processOrder(invoice, orderId)` → emit `orderProcessed$` event
- Main page subscribe event này → tạo tab invoice mới từ order data
- Invoice ID: `"HD" + Date.now()`
- Giữ nguyên `customerPaid` từ order, tính `debt = customerPaid - (totalPrice - discountAmount)`

## 3. Order Statuses

| Status | Ý nghĩa |
|--------|---------|
| `pending` | Chờ xử lý (mặc định khi tạo) |
| `checked` | Đã xử lý (đã tạo invoice) |
| `canceled` | Đã hủy |
| `edited` | Đã chỉnh sửa |

## 4. Order Detail (In đơn)
- File: `TapHoa39BanHang/src/app/components/order-detail/order-detail.component.ts`
- Template in hóa đơn đặt hàng
- Hiển thị: Mã HĐ, ngày, khách hàng, danh sách SP, tổng tiền, chiết khấu, QR thanh toán
- QR: VietQR format → Techcombank `9905084032`

## 5. Data Flow Diagram

```
┌──────────────┐     POST /api/firebase/add_order     ┌──────────────┐
│  DatHang     │ ──────────────────────────────────→  │   BackEnd    │
│  (Customer)  │                                       │   (Flask)    │
└──────────────┘                                       └──────┬───────┘
                                                              │
                                                    Firestore │ orders collection
                                                    WebSocket │ order_created
                                                              │
                                                       ┌──────▼───────┐
                                                       │   BanHang    │
                                                       │   (POS)      │
                                                       └──────┬───────┘
                                                              │
                                                    ┌─────────▼─────────┐
                                                    │  View Order       │
                                                    │  → Handle Order   │
                                                    │  → Create Invoice │
                                                    └───────────────────┘
```

## 6. Firestore Structure

```
taphoa39hoadon1 (Project)
└── orders (Collection)
    └── {orderId} (Document)
        ├── id: string
        ├── customer: { Name, ContactNumber, Address }
        ├── cartItems: [{ product, quantity, unitPriceSaleOff }]
        ├── totalPrice: number
        ├── totalQuantity: number
        ├── discountAmount: number
        ├── customerPaid: number
        ├── totalCost: number
        ├── note: string
        ├── status: string
        ├── createdDate: string (ISO)
        ├── deliveryTime: string (ISO)
        └── source: string ("online" | "pos")
```
