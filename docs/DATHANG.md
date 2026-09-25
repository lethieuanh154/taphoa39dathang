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
| `/` | HomeComponent | Trang chu, hien thi san pham. Nhan `?q=<tu khoa>` de mo thang ket qua tim kiem |
| `/khuyen-mai` | PromotionPageComponent (lazy) | Trang khuyen mai rieng (xem muc duoi) |
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


## Danh muc o Home: carousel 3D + thanh ngang

Tu 2026-09-21, Home co **hai** cho chon danh muc, khong hien cung luc:

| | Khi nao hien | La gi |
|---|---|---|
| **Carousel 3D** (`cat-hero`, dau `main`) | Khi o dau trang | `app-category-3d-carousel` - vong tron 3D, cuon theo trang. Kem 2 nut **Khuyen mai** + **Tat ca** (khong nam trong vong tron). |
| **Thanh ngang** (`.category-bar`) | Khi da cuon qua carousel | Thanh icon tron cu, `position: fixed` ngay duoi header |

- Thanh ngang **khong con nam trong `.sticky-top-wrap`** ma la `position: fixed` + `[style.top.px]="stickyHeight"` (do bang chieu cao header). Nho khong nam trong luong nen bat/tat khong lam noi dung nhay - da do: `hero.offsetTop` khong doi giua 2 trang thai.
- `updateCategoryBarVisibility()` (goi trong `window:scroll` + khi `#catHero` render) bat thanh ngang khi `hero.getBoundingClientRect().bottom < stickyHeight + hero.offsetHeight * 0.4`. Khong co carousel (chua load duoc danh muc) -> thanh ngang hien luon.
- Chon tu carousel (`onCarouselSelect`) dung chung `onCategoryClick()` voi thanh ngang, sau do `scrollPastHero()` cuon vua qua carousel de thay san pham.
- Hai cho dong bo qua `[activeId]="activeCategoryId"`: chon o thanh ngang thi vong 3D tu xoay den card do (khong emit lai).
- Chiem cho: **38%** chieu cao khung nhin o 390x844, **62%** o 1366x800 (dieu chinh bang input `mobileHeightRatio` = 0.32 / `desktopHeightRatio` = 0.58). Vong tron trai **92%** be rong khung tren desktop, 2 nut nav sat vien - de vong hep lai thi giam `desktopHeightRatio`.

Chi tiet component: `docs/components/CATEGORY-3D-CAROUSEL.md`.

## Thanh danh muc ngang (Home)
Thay chip chu bang **nut icon tron + nhan** (`.cat-item`), cuon ngang, mui ten trai/phai chi hien tren desktop.
Thu tu: **Khuyen mai** (mo `/khuyen-mai`) → **Tat ca** → cac danh muc KiotViet.
- Icon/mau lay tu `shared/category-icon.ts` — `getCategoryVisual(name, index)` do tu khoa trong ten danh muc (da bo dau) ra emoji, gradient xoay vong theo index. Tinh 1 lan luc `loadCategories()` roi gan vao `Category.icon/.gradient` (khong goi trong template vi OnPush).
- **2 luat cua `KEYWORD_ICONS` (2026-09-21):**
  1. Mang tu `.sort()` theo **do dai tu khoa giam dan** ngay tai cho khai bao -> thu tu viet trong mang khong quan trong. Truoc day xep tay nen tu khoa ngan che tu khoa dai: "van phong pham" chua "pho" -> ra 🍜, "trai cay" chua "tra" -> ra 🍵, "kem danh rang" chua "kem" -> ra 🍦, "xa phong" chua "pho", "sua tam" chua "sua".
  2. **Chi dung emoji <= Emoji 11.0 (2018).** 🪥 (13.0) va 🫙 (14.0) ra **o vuong** tren Windows 10 va Android cu (da kiem chung bang Chrome).
- Thanh danh muc **luon hien** (khong con `*ngIf="categories.length > 0"`): du khong load duoc danh muc van con nut Khuyen mai + Tat ca. Tu 2026-09-21 no chi hien **khi da cuon qua carousel 3D** (xem muc tren).

### Chuoi load danh muc (`ProductApiService.loadCategories()`)
1. Cache RAM → 2. IndexedDB (`meta/categories`, TTL 24h) → 3. **`GET /api/public/categories`** → 4. `GET /api/kiotviet/categories` (fallback) → 5. `deriveCategoriesFromCache()` suy ra tu `CategoryId/CategoryName` cua san pham trong IndexedDB.

**Ly do:** `/api/kiotviet/categories` goi thang KiotViet, token het han → **502** → FE nhan `[]` va **im lang** (catch bo qua loi >= 500) → mat sach thanh danh muc. Endpoint public lay tu Firestore nen khong dinh loi nay.
Buoc 5 dung `getAllRawCachedProducts()` chu **khong** `getAllCachedProducts()`: SP tu `/api/public/*` khong co field `isActive` nen bi ham do loc mat.

## Trang khuyen mai `/khuyen-mai`
Component: `components/promotion-page/`. Nguon du lieu: `GET /api/public/promotions/active` qua `PromotionService`.

Phan loai KM (port tu `TapHoa39BanHang/src/app/shared/promotion-engine.ts`, dung `shared/promotion-display.ts`):
| Loai | Dieu kien | Hien thi |
|------|-----------|----------|
| `gift` | co gift entry, khong giam gia | "Mua N tang X" + danh sach qua (Mien phi) |
| `direct` | co giam gia, khong gift entry | "Giam X% / X d" + gia gach ngang → gia moi |
| `buy_a_get_b` | co giam gia + co gift entry | "Mua N duoc mua X giam Y%" + gia uu dai cua SP mua kem |

- Bo loc theo loai (`Tat ca / Mua tang qua / Giam gia truc tiep / Mua kem gia uu dai`), an tab khi count = 0.
- Bam the → mo `ProductDetailComponent` (truyen `[promotion]`) de them vao gio.
- Tu dong load lai khi WebSocket bao KM thay doi (`getPromotionsUpdated$`) + `cartService.recalculatePromotions()`.
- Cache ca SP target va SP qua vao IndexedDB de gio hang resolve duoc.

### `shared/promotion-display.ts`
Ham thuan (dung chung Home + trang KM):
`getPromoKind`, `getPromoKindLabel`, `getPromoBadge`, `getPromoDetail`, `getPromoCondition`, `getGiftEntries`, `getGiftProducts`, `calcDiscountAmount`, `getDiscountedPrice`, `getPromoEndTime`.
**Quan trong:** `calcDiscountAmount()` lam tron **floor xuong 1.000d** giong `promotion-engine.ts` va BE `_recompute_order_economics()` → gia hien thi khop gia BE tinh lai luc dat hang.

## Hang het ton tren Home (2026-09-25)
`HomeComponent.appendProducts()` - tieu chi khop `product-card.isOutOfStock` (`OnHand + CloneOnHandNV <= 0`):
- **Trang chu (featured) + danh muc**: AN hang het ton.
- **Search**: hien, xep cuoi TOAN BO danh sach (khong chi trong lo 20 moi tai), giu thu tu goc moi nhom.
- `loadMore()` tai tiep toi da 5 trang/lan neu trang vua tai toan hang het ton (khong them the nao -> trang khong dai ra -> scroll khong ban lai loadMore).

## Thanh khuyen mai tren Home
Style "flash deals": nen cam, tieu de + **dem nguoc** toi KM het han som nhat (chi hien khi con < 24h) + nut "Xem tat ca" → `/khuyen-mai`.
Mui ten cuon la `<button>` that (`.deal-arrow`, `z-index: 3`), **khong con `pointer-events: none`** → bam duoc, khong bi lot click xuong san pham ben duoi.

## Lich su tang qua
Nut **"Lich su tang qua"** trong modal the thanh vien (`components/profile-bubble/`), dat giua "Doi mat khau" va "Dang xuat" → mo **dialog rieng** `components/gift-history-dialog/` (standalone, inline template, backdrop `z-index: 10000` de nam tren modal profile).
- Dialog tu load: `POST /api/chat/customer-notes` body `{ identity, token }` — identity = `sm_customer_code` → `sm_customer_phone` → `sm_customer_identity`; token = `sm_customer_token`. Tra `{ notes: [{ id, text, createdAt }] }` moi nhat truoc.
- **Token phien**: `verify-identity` tra `token` khi dang nhap thanh cong → luu `sm_customer_token` (o ca identity-dialog va profile-bubble), xoa khi logout. Thieu/het han → BE tra **401**; dialog tu goi lai `verify-identity` (khong mat khau) de xin token moi, that bai thi hien "Vui long dang nhap lai...". Xem `TapHoa39BackEnd/docs/GIFT-NOTES.md`.
- 404 (khong tim thay KH) → hien "Ban chua co lich su tang qua", khong bao loi.
- Noi dung note do nhan vien ghi tu **TapHoa39BanHang `/customers-page`** (cot "Ghi chu"), luu o field `GiftNotes` trong doc `customers`.

## Hint 1 lan cho 2 bubble keo duoc (2026-09-21)

`components/bubble-hint` — lop mo + khung vien nhay quanh **nut tai khoan** va **nut chat**, kem the huong dan "nhan giu 1 giay roi keo". Chi hien **1 lan duy nhat** moi may.

- Dat trong `app.component` (canh `app-chat-bubble`), trong khoi `@defer (when customerIdentity)` -> chi chay sau khi khach xac nhan so dien thoai.
- Co: `localStorage['sm_bubble_hint_v1'] = '1'` (doi thanh `_v2` neu muon hien lai cho khach cu). Storage bi chan -> coi nhu da xem, khong hien.
- Doi 2 bubble render xong bang cach poll `POLL_MS = 700` x `MAX_TRIES = 12` (~8s) vi profile bubble chi co o Home sau khi co danh tinh. Thieu 1 trong 2 bubble -> **khong** hien (de khong "tieu" mat lan hien duy nhat).
- Vi tri lay bang `getBoundingClientRect()` cua `app-profile-bubble` va `app-chat-bubble` — dung `querySelector` vi 2 bubble o 2 component khac nhau (chat o app root, profile trong Home qua router-outlet) nen `@ViewChild` khong voi toi.
- Hai bubble xep sat nhau (profile `bottom: 84px`/`70px`, chat `bottom: 20px`, moi cai 56px) nen ve **1 khung vien bao ca hai** thay vi 2 vong tron (2 vong se chong nhau). Bubble that bi lop mo che nen ve lai icon 👤 💬 dung vi tri tung cai.
- The huong dan tu tranh cho bubble: bubble o nua duoi -> the len tren, va nguoc lai.
- Tat: click nut "Da hieu", click ra ngoai, hoac Escape.
