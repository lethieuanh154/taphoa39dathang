# TapHoa39DatHang

Online ordering app. Angular 19, CSS only (no UI lib), mobile-first cho 30-70 tuoi.

## Routes
`/` (Home, nhan `?q=`) | `/khuyen-mai` (trang KM, lazy) | `/checkout` (lazy) | `/confirm/:orderId` (lazy)

## Critical Rules
- Order ID: `"DH" + timestamp`, status: pending → checked/canceled/edited
- API (dùng `/api/public/*` để ẩn data nội bộ): products `GET /api/public/products/{featured|by-category/<id>|search}`, KM `GET /api/public/promotions/active`, đặt hàng `POST /api/public/add_order` (BE tự tính lại giá/ship/điểm/giá vốn + flag `suspiciousOrder`). Xem `TapHoa39BackEnd/docs/PUBLIC-API.md`.
- Cart + KH info luu localStorage, khong bat login. Cart TTL 24h (`sm_cart_ts`): quá hạn tự xoá → `cartExpired$` báo, nút checkout ẩn (giỏ trống)
- Design: Green #2E7D32, Orange #F57C00, font Be Vietnam Pro min 16px, button 48px
- KM: 3 loai `gift | direct | buy_a_get_b`, phan loai + tinh gia bang `shared/promotion-display.ts` (port tu `TapHoa39BanHang/src/app/shared/promotion-engine.ts`). Giam % **floor xuong 1.000d** — phai khop BE `_recompute_order_economics()`, dung tu che cong thuc khac.
- Thanh danh muc Home luon render (icon tron tu `shared/category-icon.ts`). Danh muc lay tu `GET /api/public/categories` (suy ra tu Firestore); `/api/kiotviet/categories` chi la fallback vi tra 502 khi token KiotViet het han.

## Data Flow
`DatHang → POST add_order → BackEnd → Firestore → WebSocket → BanHang (POS)`

## Docs
`docs/`: DATHANG, ORDER-FLOW, components/*
