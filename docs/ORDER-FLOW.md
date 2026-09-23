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

### 1.2b Phí ship & chiết khấu sỉ (cập nhật 23/09/2026)

`ShippingService.calculateShipCost(orderSubtotal, distanceKm)` — **đã bỏ phụ phí hàng nặng**:

| Giá trị đơn | Miễn phí ship | Phí vượt |
|---|---|---|
| < 200k | Không giao | — |
| 200k – <500k | Không miễn | 13.000đ/km (**tối thiểu 1km**) |
| 500k – <1tr | ≤1 km | 6.000đ/km |
| 1 – <2tr | ≤2 km | 5.000đ/km |
| 2 – <5tr | ≤3 km | 5.000đ/km |
| 5 – <10tr | ≤5 km | 5.000đ/km |
| ≥10tr | ≤8 km | 4.000đ/km |

#### Geocoding — quy tac chon toa do (sua 23/09/2026)

`geocodeAddress()` tra ve `{lat, lng, confidence}` voi `confidence: 'street+ward' | 'street' | 'none'`.
`pickCandidate()` chia 3 tang, **trong moi tang lay diem XA NHAT** (sai so nghieng ve phia tinh du):

| Tang | Dieu kien | Tran nang | Y nghia |
|---|---|---|---|
| A `street+ward` | khop ca ten duong VA phuong | **+2 km** | da chac dung duong, chi chua ro vi tri doc duong |
| B `street` | chi khop ten duong | **+1 km** | phai chat — DN sau sap nhap QN co nhieu duong trung ten |
| C `none` | khong khop gi | lay ket qua **#1** | **KHONG duoc lay max** |

**Ba cai bay da dinh phai, dung tai tao:**

1. **Chon theo "gan cua hang nhat"** (code cu) → `08 Phan Dinh Phung` ra `Phan Chau Trinh`: 6,2km thay vi 8,1km (thuc 8,0km).
2. **Lay max khi khong khop gi** → `120 Nui Thanh, Hai Chau` ra `Duong Thanh Dien Hai`: 9,0km thay vi 3,4km.
3. **Tinh `city` vao khop phuong** → geocoder luon tra `city = "Da Nang"` va truy van nao cung ket thuc bang "Da Nang", nen ung vien nao cung "khop phuong" → tang B sup vao tang A, an tran 2km. `28 Le Trong Tan, Hoa An` lay nham Le Trong Tan o Hoa Khanh: 5,4km thay vi 3,0km. Xem `PROVINCE_NAMES` + `matchesWard()`.

**Phuong la yeu to quyet dinh** (Da Nang da sap nhap Quang Nam, trung ten duong nhieu):
`120 Nui Thanh, Hai Chau` (quan) → Photon tra san bay / Phan Chau Trinh / Thanh Dien Hai, rac toan bo.
`120 Nui Thanh, Hoa Cuong` (phuong) → ca 5 ket qua dung Duong Nui Thanh.
→ Checkout hien canh bao khi `confidence !== 'street+ward'`, placeholder o input dia chi da doi thanh `VD: 120 Nui Thanh, Hoa Cuong, Da Nang`. Khong chan dat hang.

**Da BO (23/09/2026):** khong con danh sach vi tri cho khach tu chon, va khong con canh bao "chua khop phuong" tren checkout. `geocodeAddress()` tra ve **mot** toa do, he thong tu quyet theo 3 tang o tren. Dung them lai picker: no bat khach tra loi cau hoi ma khach khong co du lieu de tra.

**Do kiem chung** (Photon that, 7 dia chi): 5/7 dung dai GMaps o tang A, 1 tang B sai 0,5km (thien ve du), 1 tang C duoc canh bao.
`ROAD_FACTOR = 1.3` da kiem chung dung (he so that do duoc 1,109 va 1,286) — **dung doi**.

BE khong geocode — no nhan `lat/lng` tu FE roi tinh lai haversine, nen sua FE la BE dung theo.

`calculatePickupBulkDiscount(items)` — **chức năng mới**: khách mua **trên 10 thùng** hàng nặng (`HEAVY_PATTERN` + `Unit === 'thùng'`) và **tự đến lấy hàng** → giảm **2.000đ/thùng**.

- Chỉ áp dụng khi `wantDelivery === false`. Đơn giao tận nơi **không** được chiết khấu này (giá sỉ = giá tại cửa hàng).
- Getter trong `CheckoutComponent`: `heavyCaseCount`, `bulkDiscount` (=0 khi giao hàng), `potentialBulkDiscount` (dùng cho gợi ý khi đang chọn giao hàng).
- `RewardService.calculateFinal(..., bulkDiscount)` trừ chiết khấu **trước** khi cap điểm thưởng → trả thêm `bulkDiscount`, `subtotalAfterBulk`.
- Gửi lên BE qua `pickupBulkDiscount` + `heavyCaseCount`, và cộng vào `discountAmount`.

> BE tự tính lại cả hai (`_calc_ship_cost`, `_pickup_bulk_discount` trong `routes/firebase_public.py`) — **sửa một bên phải sửa bên kia**, lệch là khách thấy một đằng trả một nẻo. Xem `TapHoa39BackEnd/docs/PUBLIC-API.md`.

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
taphoa39hoadon (Project)
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
