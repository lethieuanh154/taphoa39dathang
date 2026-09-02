/**
 * Helper hien thi khuyen mai cho DatHang.
 * Port tu TapHoa39BanHang/src/app/shared/promotion-engine.ts (phan phan loai + tinh giam gia)
 * de FE hien thi dung so tien ma BE se tinh lai luc dat hang.
 *
 * 3 loai KM:
 *   gift        - Mua A tang B (hasGift + co gift entry)
 *   direct      - Giam gia truc tiep tren A (co giam, khong gift entry)
 *   buy_a_get_b - Mua A duoc mua B gia uu dai (co giam + co gift entry)
 */
import { Promotion, GiftEntry, GiftProduct } from '../models/product';

export type PromoKind = 'gift' | 'direct' | 'buy_a_get_b';

export function hasGift(p: Promotion): boolean {
  return p.hasGift ?? p.type === 'gift';
}

export function hasPercentDiscount(p: Promotion): boolean {
  return p.hasPercentDiscount ?? p.type === 'percentage';
}

export function hasFixedDiscount(p: Promotion): boolean {
  return p.hasFixedDiscount ?? p.type === 'fixed_amount';
}

export function hasAnyDiscount(p: Promotion): boolean {
  return hasPercentDiscount(p) || hasFixedDiscount(p);
}

/** Gift entries da chuan hoa (BE tra giftItems, fallback field scalar cu). */
export function getGiftEntries(p: Promotion): GiftEntry[] {
  if (p.giftItems && p.giftItems.length > 0) return p.giftItems;
  if (p.giftProductId) {
    return [{
      productId: String(p.giftProductId),
      code: p.giftProductCode,
      name: p.giftProductName,
      basePrice: p.giftProductBasePrice,
      quantity: p.giftQuantity ?? 1
    }];
  }
  return [];
}

/** Product data day du cua gift (co Image/BasePrice) - dung de render card. */
export function getGiftProducts(p: Promotion): GiftProduct[] {
  return p.giftProducts && p.giftProducts.length > 0 ? p.giftProducts : [];
}

export function getPromoKind(p: Promotion): PromoKind {
  const gifted = getGiftEntries(p).length > 0;
  if (hasAnyDiscount(p)) return gifted ? 'buy_a_get_b' : 'direct';
  return 'gift';
}

export function getPromoKindLabel(p: Promotion): string {
  switch (getPromoKind(p)) {
    case 'gift': return 'Mua tặng quà';
    case 'buy_a_get_b': return 'Mua kèm giá ưu đãi';
    default: return 'Giảm giá trực tiếp';
  }
}

/**
 * So tien giam tren 1 don vi - khop promotion-engine.ts va BE recompute:
 * % → lam tron xuong boi 1.000d, neu ra 0 thi lay so tron thuong.
 */
export function calcDiscountAmount(basePrice: number, p: Promotion): number {
  if (hasPercentDiscount(p) && p.discountPercent) {
    const raw = basePrice * p.discountPercent / 100;
    const rounded = Math.floor(raw / 1000) * 1000;
    return rounded > 0 ? rounded : Math.round(raw);
  }
  if (hasFixedDiscount(p) && p.discountAmount) {
    return p.discountAmount;
  }
  return 0;
}

/** Gia sau giam. Voi buy_a_get_b thi giam ap len gift product, khong phai target. */
export function getDiscountedPrice(basePrice: number, p: Promotion): number {
  return Math.max(0, basePrice - calcDiscountAmount(basePrice, p));
}

/** Text ngan tren badge: "TẶNG", "-20%", "-10K". */
export function getPromoBadge(p: Promotion): string {
  const parts: string[] = [];
  if (hasGift(p)) parts.push('TẶNG');
  if (hasPercentDiscount(p) && p.discountPercent) parts.push(`-${p.discountPercent}%`);
  if (hasFixedDiscount(p) && p.discountAmount) {
    const amt = p.discountAmount;
    parts.push(amt >= 1000 ? `-${Math.round(amt / 1000)}K` : `-${amt}đ`);
  }
  return parts.join(' + ') || 'SALE';
}

/** Mo ta day du: "Mua 2 tặng 1 Nước ngọt", "Giảm 20%", "Mua 1 được mua 1 X giảm 30%". */
export function getPromoDetail(p: Promotion): string {
  const min = p.minQuantity || 1;
  const gifts = getGiftEntries(p);
  const kind = getPromoKind(p);

  if (kind === 'gift') {
    const list = gifts.map(g => `${g.quantity > 1 ? g.quantity + ' ' : ''}${g.name || ''}`.trim())
                      .filter(Boolean).join(' + ');
    return list ? `Mua ${min} tặng ${list}` : `Mua ${min} tặng quà`;
  }

  const discText = hasPercentDiscount(p) && p.discountPercent
    ? `${p.discountPercent}%`
    : `${(p.discountAmount || 0).toLocaleString('vi-VN')}đ`;

  if (kind === 'buy_a_get_b') {
    const list = gifts.map(g => `${g.quantity > 1 ? g.quantity + ' ' : ''}${g.name || ''}`.trim())
                      .filter(Boolean).join(' + ');
    return list ? `Mua ${min} được mua ${list} giảm ${discText}` : `Mua ${min} giảm ${discText}`;
  }

  return min > 1 ? `Mua ${min} giảm ${discText}` : `Giảm ${discText}`;
}

/** Dieu kien ap dung. */
export function getPromoCondition(p: Promotion): string {
  const min = p.minQuantity || 1;
  return min > 1 ? `Áp dụng khi mua từ ${min} sản phẩm` : 'Áp dụng cho mọi đơn có sản phẩm này';
}

/** Thoi diem het han (ms) - dung cho dem nguoc. Tra 0 neu khong hop le. */
export function getPromoEndTime(p: Promotion): number {
  const t = p.toDate ? new Date(p.toDate).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}
