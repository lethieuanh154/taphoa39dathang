# TapHoa39DatHang

Online ordering app. Angular 19, CSS only (no UI lib), mobile-first cho 30-70 tuoi.

## Routes
`/` (Home) | `/checkout` (lazy) | `/confirm/:orderId` (lazy)

## Critical Rules
- Order ID: `"DH" + timestamp`, status: pending → checked/canceled/edited
- API: `GET /api/item/{searchTerm}`, `POST /api/firebase/add_order`
- Cart + KH info luu localStorage, khong bat login
- Design: Green #2E7D32, Orange #F57C00, font Be Vietnam Pro min 16px, button 48px

## Data Flow
`DatHang → POST add_order → BackEnd → Firestore → WebSocket → BanHang (POS)`

## Docs
`docs/`: DATHANG, ORDER-FLOW, components/*
