# TapHoa39DatHang

Online ordering app. Angular 19, CSS only (no UI lib), mobile-first cho 30-70 tuoi.

## Routes
`/` (Home) | `/checkout` (lazy) | `/confirm/:orderId` (lazy)

## Critical Rules
- Order ID: `"DH" + timestamp`, status: pending → checked/canceled/edited
- API (dùng `/api/public/*` để ẩn data nội bộ): products `GET /api/public/products/{featured|by-category/<id>|search}`, KM `GET /api/public/promotions/active`, đặt hàng `POST /api/public/add_order` (BE tự tính lại giá/ship/điểm/giá vốn + flag `suspiciousOrder`). Xem `TapHoa39BackEnd/docs/PUBLIC-API.md`.
- Cart + KH info luu localStorage, khong bat login. Cart TTL 24h (`sm_cart_ts`): quá hạn tự xoá → `cartExpired$` báo, nút checkout ẩn (giỏ trống)
- Design: Green #2E7D32, Orange #F57C00, font Be Vietnam Pro min 16px, button 48px

## Data Flow
`DatHang → POST add_order → BackEnd → Firestore → WebSocket → BanHang (POS)`

## Docs
`docs/`: DATHANG, ORDER-FLOW, components/*
