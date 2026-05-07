# CheckoutComponent

## Mo ta
Trang dat hang voi form thong tin va lua chon thanh toan.

## Route
`/checkout` (lazy loaded)

## Chuc nang
- Tom tat don hang (danh sach SP, tong tien)
- Form thong tin nhan hang:
  - Ho ten (bat buoc)
  - So dien thoai (bat buoc, >= 9 ky tu)
  - Dia chi giao hang (bat buoc)
  - Ghi chu (khong bat buoc)
- Lua chon thanh toan:
  - COD - Thanh toan khi nhan hang (mac dinh)
  - Chuyen khoan QR - Hien thi ma QR VietQR (Techcombank 9905084032)
- Luu thong tin khach hang vao localStorage
- Load lai thong tin khach hang tu localStorage
- Validation: disable nut khi thieu thong tin bat buoc
- Submit: POST /api/firebase/add_order → redirect /confirm/:orderId

## Dependencies
- `CartService` - Lay danh sach san pham
- `OrderApiService` - Gui don hang len server
- `Router` - Dieu huong
