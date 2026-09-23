# ProductDetailComponent

## Mo ta
Dialog chi tiet san pham, mo khi user click/tap 1 card o Home.

## Selector
`app-product-detail`

## Inputs / Outputs
- `@Input() product: Product`
- `@Input() group: Product[]` - cac don vi tinh cung nhom
- `@Input() isSale: boolean`
- `@Input() promotion: Promotion | null`
- `@Output() close: EventEmitter<void>`

## Anh san pham
- `.detail-image` dung `object-fit: contain` + `padding: 16px` (nen `#fafafa`) - anh thu nho, khong bi crop sat khung.
- Gallery nhieu anh: nut prev/next + counter + thumbnail strip.

## Zoom kinh lup (chi co trong dialog nay, KHONG co o card ngoai Home)
- Hover chuot len vung anh -> lens tron 150px phong to 2.5x, bam theo con tro, clamp trong khung anh.
- Chi bat khi co `currentImage` va thiet bi `matchMedia('(hover: hover) and (pointer: fine)')` -> tat hoan toan tren mobile/touch.
- Lens `pointer-events: none`, `z-index: 4`; nut `.img-nav` nang len `z-index: 6` de khong bi lens che.
- **Bay:** `.zoom-img` PHAI co `max-width: none; max-height: none;` de chan rule global `img { max-width: 100% }` trong `src/styles.css`. Neu khong, anh phong to bi co ve be rong lens roi day ra ngoai vung nhin -> lens trang xoa.

### State / Methods
- `showZoom: boolean` - trang thai hien lens
- `get canZoom(): boolean` - co `currentImage`
- `onZoomEnter() / onZoomLeave()` - bat/tat lens (`markForCheck`, component OnPush)
- `onZoomMove(event: MouseEvent): void` - cap nhat vi tri lens + anh phong to bang thao tac DOM truc tiep, khong trigger change detection moi lan di chuot
- Hang so: `LENS_SIZE = 150`, `ZOOM_SCALE = 2.5`, `IMG_PADDING = 16` (phai khop `padding` cua `.detail-image`, anh trong lens duoc scale padding theo `IMG_PADDING * ZOOM_SCALE`)

## Dependencies
- `CartService` - them vao gio hang

## Fix mobile (2026-09-21)

1. **Dialog bi cat o tren khi dang o dau trang.** Block `@media (max-width: 480px)` dat `align-items: flex-end` (bottom sheet) + `max-height: 95vh`. Tren Chrome Android, `vh` = layout viewport (**khong** tru thanh URL), nen khi thanh URL dang hien (luc o dau trang) `95vh` > vung thuc su nhin thay -> dialog dinh day thi phan TREN bi day ra ngoai. Cuon xuong thanh URL an di nen het loi -> de tuong la do carousel 3D.
   - Sua: them `max-height: 92dvh` (`dvh` = vung thuc nhin thay), backdrop dung `height: 100dvh` thay `bottom: 0`, va `margin: auto` / `margin: auto 0 0` tren dialog + `overflow-y: auto` tren backdrop de neu con tran thi **cuon len duoc** chu khong bi cat (chi `align-items` se cat cung).
   - Giu nguyen `95vh` / `100vh` phia truoc lam fallback cho trinh duyet cu.
2. **Trang nen van cuon duoc khi dialog dang mo.** `ngOnInit` them class `sm-modal-open` vao `document.body` (`overflow: hidden`, khai bao o `src/styles.css`), `ngOnDestroy` bo ra. Them `overscroll-behavior: contain` de cuon het dialog khong keo lan sang trang nen.
   - **Cac dialog khac (cart-panel, profile-bubble, gift-history, identity) chua khoa scroll** — dung chung class nay neu can.
