# ProductCardComponent

## Mo ta
Card hien thi thong tin 1 san pham: hinh anh, ten, don vi, gia, nut them vao gio.

## Selector
`app-product-card`

## Inputs
- `@Input() product: Product` - Du lieu san pham

## Chuc nang
- Hien thi hinh anh san pham (lazy loading), `object-fit: contain` + padding 10px de anh khong fit sat khung
- Ten san pham (gioi han 2 dong)
- Don vi tinh
- Gia ban (dinh dang VND)
- Badge "Het hang" khi OnHand <= 0
- Nut "Them" voi animation check khi them thanh cong
- Disable nut khi het hang
- Nut info (goc tren trai anh) - chi hien khi `product.Description` khong rong. Click/tap mo overlay hien noi dung field "Mo ta" phu len anh; click lai vao overlay de dong. `stopPropagation` nen khong trigger `cardClick`.

## State / Methods
- `showDescription: boolean` - trang thai mo/dong overlay mo ta
- `get hasDescription(): boolean` - `product.Description` co noi dung sau khi trim
- `toggleDescription(event: Event): void` - toggle overlay, chan noi bot su kien, `markForCheck` (OnPush)

> Zoom kinh lup KHONG co o card (grid Home) - chi co trong dialog chi tiet, xem `PRODUCT-DETAIL.md`.

> **Trang thai hien tai (2026-09-14): nut info KHONG BAO GIO hien.** `_public_product` trong `TapHoa39BackEnd/routes/firebase_public.py` da cat field `Description` khoi response `/api/public/products/*` vi du lieu Firestore dang chua ghi chu noi bo (gia si / gia nhap: `"k vat"`, `"1T (20g) = 570k"`). Code nut info giu nguyen, tu bat lai khi BE tra `Description` tro lai. Xem `TapHoa39BackEnd/docs/PUBLIC-API.md`.

## Dependencies
- `CartService` - Them san pham vao gio hang
