/**
 * Icon + mau nen cho nut danh muc tren trang chu.
 * Chon theo tu khoa trong ten danh muc (KiotViet tra ten tu do), fallback theo index.
 */
export interface CategoryVisual {
  icon: string;
  gradient: string;
}

const GRADIENTS = [
  'linear-gradient(135deg,#ffb74d,#f57c00)',
  'linear-gradient(135deg,#4fc3f7,#0288d1)',
  'linear-gradient(135deg,#81c784,#2e7d32)',
  'linear-gradient(135deg,#ff8a65,#e64a19)',
  'linear-gradient(135deg,#ba68c8,#7b1fa2)',
  'linear-gradient(135deg,#4db6ac,#00796b)',
  'linear-gradient(135deg,#f06292,#c2185b)',
  'linear-gradient(135deg,#9575cd,#512da8)',
  'linear-gradient(135deg,#ffd54f,#f9a825)',
  'linear-gradient(135deg,#64b5f6,#1565c0)'
];

/** Tu khoa (khong dau, thuong) -> emoji. Uu tien tu khoa dai truoc. */
const KEYWORD_ICONS: Array<[string, string]> = [
  ['card', '💳'], ['an vat', '🍿'],
  ['nuoc giai khat', '🥤'], ['nuoc ngot', '🥤'], ['nuoc suoi', '💧'], ['nuoc uong', '🥤'],
  ['bia', '🍺'], ['ruou', '🍷'],
  ['sua chua', '🥛'], ['sua', '🥛'],
  ['banh keo', '🍬'], ['banh', '🍪'], ['keo', '🍬'], ['snack', '🍿'],
  ['mi', '🍜'], ['pho', '🍜'], ['bun', '🍜'], ['chao', '🥣'],
  ['gia vi', '🧂'], ['nuoc mam', '🧂'], ['dau an', '🫙'], ['duong', '🍚'],
  ['gao', '🌾'], ['do kho', '🌾'],
  ['ca phe', '☕'], ['tra', '🍵'],
  ['do hop', '🥫'], ['dong lanh', '🧊'], ['kem', '🍦'],
  ['rau', '🥬'], ['trai cay', '🍎'], ['hoa qua', '🍎'], ['thit', '🥩'], ['ca ', '🐟'], ['trung', '🥚'],
  ['hoa my pham', '🧴'], ['my pham', '💄'], ['cham soc', '🧴'],
  ['dau goi', '🧴'], ['sua tam', '🧼'], ['xa phong', '🧼'], ['kem danh rang', '🪥'],
  ['giat', '🧺'], ['tay rua', '🧽'], ['ve sinh', '🧽'],
  ['giay', '🧻'], ['ta', '🍼'], ['bim', '🍼'], ['em be', '🍼'], ['tre em', '🧸'],
  ['gia dung', '🍳'], ['gia dinh', '🏠'], ['nha bep', '🍳'], ['dung cu', '🔧'],
  ['van phong pham', '✏️'], ['do choi', '🧸'],
  ['thuoc', '💊'], ['y te', '💊'],
  ['thuc pham', '🛒'], ['hang', '📦']
];

function normalize(s: string): string {
  return s.normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

export function getCategoryVisual(name: string, index: number): CategoryVisual {
  const n = normalize(name || '');
  let icon = '';
  for (const [kw, ic] of KEYWORD_ICONS) {
    if (n.includes(kw)) { icon = ic; break; }
  }
  if (!icon) icon = '🛒';
  return { icon, gradient: GRADIENTS[index % GRADIENTS.length] };
}
