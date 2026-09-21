# Category3dCarouselComponent

## Mo ta
Vong xoay danh muc 3D (3D circular carousel): cac card danh muc nam tren mot **cylinder** quanh truc doc o giua, card phia truoc to/ro nhat, card ra sau nho - mo - blur nhe. Thuan CSS 3D transform + TypeScript, **khong GSAP / Three.js**.

Component doc lap, data-driven, khong tu dieu huong (parent nhan event roi tu quyet dinh).
**Dang dung o**: Home (`cat-hero`, dau `main` - xem `docs/DATHANG.md`) va trang demo `/demo-danh-muc-3d`.

## Selector
`app-category-3d-carousel`

## File
```
src/app/components/category-3d-carousel/
├── category-3d-carousel.component.ts
├── category-3d-carousel.component.html
└── category-3d-carousel.component.css
src/app/components/category-carousel-demo/    # trang demo 10 danh muc + bang tuy chon
```

## Interface
```ts
export interface Category3D {
  id: string;
  name: string;
  image?: string;     // thieu -> dung icon + gradient
  slug?: string;
  icon?: string;      // thieu -> suy ra tu ten bang getCategoryVisual()
  gradient?: string;  // thieu -> suy ra tu ten bang getCategoryVisual()
}
```
`image` la optional (khac ban goc yeu cau) vi danh muc lay tu `/api/public/categories` **khong co anh** - card tu fallback ve emoji + gradient cua `shared/category-icon.ts`.

## Inputs
| Input | Default | Y nghia |
|-------|---------|---------|
| `categories: Category3D[]` | `[]` | Danh sach danh muc. So luong bao nhieu cung duoc (3, 5, 10, 20...) |
| `autoRotate: boolean` | `false` | Tu xoay sang danh muc ke tiep |
| `autoRotateInterval: number` | `4500` | Chu ky auto rotate (ms), toi thieu 800 |
| `autoResumeDelay: number` | `2500` | Khong tuong tac bao lau thi auto rotate chay lai |
| `disableAutoRotateOnMobile: boolean` | `true` | Tat auto rotate khi `(hover: none) and (pointer: coarse)` |
| `cardWidth / cardHeight: number` | `200 / 280` | Kich thuoc card o desktop; tablet/mobile tu scale xuong |
| `radius: number` | `0` | `0` = tu tinh theo so luong card |
| `enableDrag / enableTouch` | `true` | Keo chuot / vuot cam ung (phan biet bang `pointerType`) |
| `enableWheel: boolean` | `false` | **Mac dinh tat** vi wheel phai `preventDefault` -> chan scroll trang khi tro chuot trong carousel |
| `enableKeyboard: boolean` | `true` | ArrowLeft/Right, Home/End, Enter/Space |
| `maxDots: number` | `15` | Nhieu hon nguong nay thi doi dots sang thanh progress `n / total` |
| `mobileHeightRatio: number` | `0.32` | < 640px: chieu cao toi da theo ti le chieu cao khung nhin |
| `desktopHeightRatio: number` | `0.42` | >= 640px: tuong tu (laptop 800px cao se tu co card lai) |
| `activeId?: string \| null` | - | Dong bo tu ngoai: id danh muc dang chon -> vong tu xoay den, **khong** emit |
| `ariaLabel: string` | `'Danh mục sản phẩm'` | `aria-label` cua vung carousel |

## Outputs
- `categorySelected: EventEmitter<Category3D>` - chi emit khi **chu dong chon**: click card, click dot, Enter/Space. Auto rotate / drag / wheel / nut ‹ › **khong** emit.

## Public method
- `getShortestRotation(currentIndex, targetIndex, totalItems): number` - so buoc xoay ngan nhat co dau. VD 8 item, `0 -> 7` tra ve `-1` (xoay nguoc 1 buoc) thay vi `+7`.

## Cach dung
```html
<app-category-3d-carousel
    [categories]="categories"
    [autoRotate]="true"
    [autoRotateInterval]="4500"
    (categorySelected)="onCategorySelected($event)">
</app-category-3d-carousel>
```

## 3D geometry (phan quan trong)
```
step   = 360 / categories.length            // goc giua 2 card
card i = rotateY(i * step) translateZ(R) scale(...)
ring   = rotateX(--tilt) translateZ(-R) rotateY(--ring)
```
- **`translateZ(-R)` tren ring** day tam vong tron ve sau -> card phia truoc nam dung mat phang man hinh (z = 0), khong bi phoi canh phong to bat thuong.
- **`--tilt: -10deg`** nghieng cylinder de cung phia sau nhin cao hon cung phia truoc (giong nhin hoi tu tren xuong).
- **Perspective**: `P = PERSPECTIVE_K * R` voi `PERSPECTIVE_K = 2.6`. He so nay quyet dinh **nua be rong vong sau khi chieu** = `SILHOUETTE * R` voi `SILHOUETTE = K/(K+1) = 0.722`. Tang K -> vong trai rong hon trong cung khung, phoi canh diu hon; giam K -> phoi canh gat hon nhung vong hep lai.
- **Ban kinh**: `R = (cardW/2) / tan(pi/n) * gap` — ban kinh nho nhat de 2 card ke nhau khong dam vao nhau, nhan them khoang ho `gap`:
  - `RING_GAP = 1.5` khi `< 13` card, `RING_GAP_MANY = 1.25` khi `>= 13` card
  - San toi thieu `cardW * 1.7` (rat it card: 3 card cach nhau 120 do nhung card phia sau van chieu lot ra hai ben nen phai ep san)
  - Neu card bi **chan boi chieu cao** ma ngang con trong thi cho noi R them toi da 15% (`FILL_LIMIT_MANY`, **chi voi >= 13 card** - it card ma noi nua se thanh roi rac)
- **Trai het be rong khung** (`fillCardWidth()`): noi **kich thuoc card** (vong to theo) cho `2 * (SILHOUETTE * kR + 0.4) * cardW = stageW`, chu **khong** giang rieng ban kinh - giang ban kinh se ra card nho ma khe giua chung ho hoac (da thu, trong roi rac).
- **KHONG chan ban kinh theo be rong stage.** Voi 18-20 danh muc, vong tron rong hon stage la dung: `overflow: hidden` cat bot hai ben, doi lai card **khong chong nhau**.
- **Cho trong cho tilt** (`tiltRoom()`): `stage-h = cardH * 1.42 + min(R * 0.12, cardH * 0.34)`.
- **Hai mat card**: `.face-front` + `.face-back` (`rotateY(180deg)`), ca hai `backface-visibility: hidden` -> card quay ra sau hien mat sau (icon mo) chu **khong bi lat guong chu**.
- Card o gan ±90° bi nhin gan nhu nghieng canh nen chi con mot dai mong - day la ket qua phoi canh dung, khong phai bug.

## Do thuc te theo so luong (stage 980px, auto rotate tat, trang thai da on dinh)
| So danh muc | Card | Ban kinh | Khe active <-> card ke | Stage |
|-------------|------|----------|------------------------|-------|
| 3 | 217px | 369 | +34px | 476px |
| 10 | 210px | 485 | +62px | 476px |
| **18** (so danh muc that) | 170px | 603 | **+16px** | 410px |
| 20 | 170px | 671 | +16px | 418px |

Khe duong = khong chong nhau. Cac card o goc lon hon (ra sau) van xep lop len nhau - khong tranh duoc voi 18 card va cung khong sao vi chung mo/nho/blur. Voi `> 15` danh muc, dots tu doi thanh progress `3 / 18`.

## Trai het be rong khung
Do tren Home, stage 1168px, 18 danh muc: card **173 x 242**, ban kinh 705, vong trai **1080px = 92%** be rong khung, con ho 44px moi ben, 2 nut nav cach vien 6px.

**Danh doi:** `fill%` bi chan boi chieu cao cho phep (`desktopHeightRatio`) - 18 card khong the vua trai het be rong **va** card cao **va** section thap cung luc. Tren laptop 1366x800:

| `desktopHeightRatio` | Card | Fill | Chieu cao hero (nut + carousel) |
|----------------------|------|------|---------------------------------|
| 0.42 | 123 x 172 | 62% | 380px = 48% khung nhin |
| **0.58** (mac dinh) | 173 x 242 | **92%** | 500px = 62% khung nhin |

## Nhan danh muc (`fitLabels()`)
Ten danh muc **luon hien du**, khong bao gio cat thanh `...`:
1. Cho xuong toi da 2 dong (`white-space: normal` + `text-wrap: balance`).
2. Co chu do JS tinh: do be rong chu bang `canvas.measureText` (khong doc layout), lay `min` cua "tu dai nhat vua 1 dong" va "ca ten vua 2 dong", clamp trong `[10px, min(cardW * 0.115, 18px)]`.
3. Doc `scrollHeight` **mot lan** cho ca dan card de bat truong hop hiem con tran, roi co nho theo ti le.

Do thuc te: 390px -> 12px/1 dong cho "Hoa my pham", 10px/2 dong cho "Thuc pham dong lanh nhap khau"; 1240px -> 18px, `scrollWidth - clientWidth = 0` o moi card (khong cat chu).

## Bay da gap (dung sua lai)
- **`box-shadow` co ca `inset` lan outer tren element bi transform 3D** lam Chrome composite sai: hien mot vet sang hinh chu nhat phia sau card active. Vi vay vien trang cua card active dung `outline: 3px solid ... ; outline-offset: -3px`, va `.face-inner` chi co **mot** box-shadow outer.
- **`<button>` cho card** lam hong `transform-style: preserve-3d` -> dung `div role="button"` + tu xu ly Enter/Space.
- **`setPointerCapture`** keo luon `click` ve the bat capture -> `(click)` tren card khong ban. Dung listener `pointermove/up` tren `window`.
- **`opacity` / `filter` tren `.face`** se flatten 3D va pha `backface-visibility` -> day xuong lop `.face-inner` ben trong.
- **Chan ban kinh theo be rong stage** lam 18+ card chong nhau. Ban kinh phai do so luong card quyet dinh, khong phai be rong khung.

## Performance
- JS moi frame chi ghi **2 CSS var**: `--ring` tren ring va `--d` (do sau 0..1) tren tung card. `transform / opacity / filter / box-shadow` do CSS tu tinh bang `calc()`.
- Drag: listener dang ky trong `runOutsideAngular`, gom frame bang `requestAnimationFrame` -> **khong** chay change detection trong `pointermove`.
- Luc drag them class `.no-anim` de bo transition (card di theo con tro), nha chuot thi bat lai transition.
- **Hai bo transition khac nhau**: user thao tac = `650ms cubic-bezier(0.22, 1, 0.36, 1)` (nhanh, dut khoat); auto rotate = class `.auto-anim` tren stage doi thanh `1500ms cubic-bezier(0.37, 0, 0.63, 1)` (sine in-out, cham va diu). `rotateToIndex(target, smooth)` quyet dinh dung bo nao.
- `ResizeObserver` tren stage -> do lai kich thuoc/ban kinh khi doi kich thuoc man hinh.
- `IntersectionObserver`: cuon ra ngoai khung nhin -> **dung auto rotate**, cuon lai -> chay tiep (da do tren Home).
- `ngOnDestroy` don: interval, timeout, rAF, ResizeObserver, IntersectionObserver, moi event listener.

## Drag / snap
- Keo ngang bang 1 be rong card ~ xoay dung 1 buoc.
- Nha chuot: snap ve card gan nhat `round(-ringAngle / step)`; keo nhanh (velocity > 0.5 px/ms) thi di them 1 buoc theo huong keo.
- Dung `pointermove/pointerup` tren **window** thay vi `setPointerCapture`, vi pointer capture keo luon `click` ve the bat capture -> `(click)` tren card se khong ban.
- `touch-action: pan-y` tren stage: vuot doc van scroll trang binh thuong, chi vuot ngang moi xoay carousel.

## Accessibility
- Card la `div role="button"` (khong dung `<button>` vi UA style cua button lam hong `transform-style: preserve-3d`) -> component tu xu ly Enter/Space.
- Roving tabindex: chi card active co `tabindex="0"`, `aria-current="true"`; Tab vao card nao thi card do xoay ra truoc.
- Nut ‹ › co `aria-label`; dot co `aria-label` "Xem danh mục X"; co vung `aria-live="polite"` doc ten danh muc active.
- Active khong chi phan biet bang mau: dau tich tron o goc tren phai + vien trang + chu dam hon.
- `prefers-reduced-motion: reduce` -> rut transition con 1ms.

## Responsive
Buoc 1 - scale theo be rong stage (chua tinh chan chieu cao):

| Man hinh | Card |
|----------|------|
| >= 1024px | 200 x 280 |
| 640-1023px | ~170 x 238 (x0.85) |
| 420-639px | ~144 x 202 (x0.72) |
| < 420px | ~120 x 168 (x0.6) |

Duoi 640px: 2 nut ‹ › **xuong hang duoi** canh dots (grid areas) de khong de len card hai ben; vong tron chiem het be rong stage, `overflow: hidden` nen khong tran viewport.

**Chan chieu cao tren mobile** (`heightBudget()`): duoi 640px, `stage-h <= vh * mobileHeightRatio - 46` (46px la hang dots + nut). Neu vuot, ca `cardW` va `cardH` co lai theo cung ti le (giu aspect ratio) roi tinh lai ban kinh. San toi thieu 86 x 118 de chu con doc duoc. Do thuc te:

| Thiet bi | Card | Toan component | % chieu cao man hinh |
|----------|------|----------------|----------------------|
| 390 x 844 | 103 x 144 | 273px | 32% |
| 430 x 932 | 115 x 161 | 300px | 32% |
| 360 x 640 | 86 x 118 | 233px | 36% (bi san kich thuoc card chan lai) |
| 768 x 1024 (tablet) | 170 x 238 | 416px | 41% (khong ap dung chan, >= 640px) |
