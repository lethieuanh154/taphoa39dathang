# TapHoa39DatHang

Online ordering app. Angular 19, CSS only (no UI lib), mobile-first cho 30-70 tuoi.

## Routes
`/` (Home, nhan `?q=`) | `/khuyen-mai` (trang KM, lazy) | `/checkout` (lazy) | `/confirm/:orderId` (lazy) | `/demo-danh-muc-3d` (demo carousel danh muc 3D, lazy)

## Critical Rules
- Order ID: `"DH" + timestamp`, status: pending → checked/canceled/edited
- API (dùng `/api/public/*` để ẩn data nội bộ): products `GET /api/public/products/{featured|by-category/<id>|search}`, KM `GET /api/public/promotions/active`, đặt hàng `POST /api/public/add_order` (BE tự tính lại giá/ship/điểm/giá vốn + flag `suspiciousOrder`). Xem `TapHoa39BackEnd/docs/PUBLIC-API.md`.
- Lich su tang qua (profile → dialog `gift-history-dialog`): `POST /api/chat/customer-notes` body `{identity, token}`; token do `verify-identity` phat, luu `sm_customer_token`, **thieu/het han → 401**. Xem `TapHoa39BackEnd/docs/GIFT-NOTES.md`.
- Cart + KH info luu localStorage, khong bat login. Cart TTL 24h (`sm_cart_ts`): quá hạn tự xoá → `cartExpired$` báo, nút checkout ẩn (giỏ trống)
- Design: Green #2E7D32, Orange #F57C00, font Be Vietnam Pro min 16px, button 48px
- KM: 3 loai `gift | direct | buy_a_get_b`, phan loai + tinh gia bang `shared/promotion-display.ts` (port tu `TapHoa39BanHang/src/app/shared/promotion-engine.ts`). Giam % **floor xuong 1.000d** — phai khop BE `_recompute_order_economics()`, dung tu che cong thuc khac.
- Danh muc Home co **2 cho**: carousel 3D (`cat-hero`, dau `main`, hien khi o dau trang) va thanh ngang `.category-bar` (`position: fixed`, hien khi da cuon qua carousel). Dong bo qua `[activeId]`, chon o dau cung goi `onCategoryClick()`. Thanh ngang **khong** con trong `.sticky-top-wrap` — de fixed cho khoi nhay layout. Icon tron tu `shared/category-icon.ts`. Danh muc lay tu `GET /api/public/categories` (suy ra tu Firestore); `/api/kiotviet/categories` chi la fallback vi tra 502 khi token KiotViet het han.

## Data Flow
`DatHang → POST add_order → BackEnd → Firestore → WebSocket → BanHang (POS)`

- Carousel danh muc 3D (`components/category-3d-carousel`): cylinder CSS 3D, JS chi ghi 2 CSS var (`--ring`, `--d`), drag chay ngoai Angular zone, auto rotate tu dung khi ra ngoai khung nhin. Dang dung o Home + `/demo-danh-muc-3d`. Xem `docs/components/CATEGORY-3D-CAROUSEL.md`.

## Docs
`docs/`: DATHANG, ORDER-FLOW, components/*
