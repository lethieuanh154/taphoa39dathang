# ProductCardComponent

## Mo ta
Card hien thi thong tin 1 san pham: hinh anh, ten, don vi, gia, nut them vao gio.

## Selector
`app-product-card`

## Inputs
- `@Input() product: Product` - Du lieu san pham

## Chuc nang
- Hien thi hinh anh san pham (lazy loading)
- Ten san pham (gioi han 2 dong)
- Don vi tinh
- Gia ban (dinh dang VND)
- Badge "Het hang" khi OnHand <= 0
- Nut "Them" voi animation check khi them thanh cong
- Disable nut khi het hang

## Dependencies
- `CartService` - Them san pham vao gio hang
