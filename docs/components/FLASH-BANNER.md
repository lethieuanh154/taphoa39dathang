# FlashBannerComponent

## Mo ta
Popup banner "Flash sale" hien giua man hinh khi mo Home, quang cao KM ngan ngay (`Promotion.isFlashBanner === true`).
`isFlashBanner` KHONG luu Firestore - BE suy ra: `toDate - fromDate < 7 ngay` (`is_flash_banner()` trong `promotion_service.py`).

## Selector
`app-flash-banner` — dat trong `home.component.html`, an khi `showIdentityDialog` dang mo.

## Nguon du lieu
- Subscribe `PromotionService.promotions$` (Home da goi `loadActivePromotions()`), khong goi API rieng.
- Lay promo co `isFlashBanner`, co `targetProduct` hop le, dedupe theo `targetProductId`, toi da 4 SP.
- Khong co promo nao → khong hien.
- KM loai `gift` (mua tang qua): hien anh qua tang (`getGiftProducts`, toi da 2) ben phai anh SP ban, noi bang dau "+", kem nhan `🎁 x{GiftQuantity}`. Loai `direct`/`buy_a_get_b` khong hien anh qua.

## Hanh vi
| Hanh dong | Ket qua |
|-----------|---------|
| Nut X / click nen toi | An; co `closedThisLoad` trong RAM → dieu huong SPA ve Home khong hien lai, **refresh (F5) la hien lai** |
| Checkbox "Khong hien lai hom nay" | Chi danh dau (`dontShowToday`); khi dong (X / nen toi / bam banner) neu dang tick → `localStorage.flashBannerHiddenDate = 'YYYY-M-D'` (ngay local) → hom sau mo lai tu hien |
| Click vao banner / "Xem ngay" | Dong + dieu huong `/khuyen-mai?loai=flash` |

Truy cap localStorage boc try/catch (private mode → luon hien).

## Trang Khuyen mai
`PromotionPageComponent` co them filter `flash` ("⚡ Flash sale") — loc `promotion.isFlashBanner`. Query `?loai=flash` chon san filter nay; neu khong con promo flash thi tu ve "Tat ca".

## Cau hinh KM (BanHang)
Khong co toggle rieng: tao/sua KM trong `promotion-dialog` (BanHang) voi "Tu ngay" - "Den ngay" < 7 ngay la thanh banner (dialog hien dong goi y ⚡). BE (`routes/firebase_promotions.py` → `_flash_banner_error`) chan KM < 7 ngay thu 5 tro di: qua 4 SP (enabled, chua het han) co thoi gian chong nhau → 400.
