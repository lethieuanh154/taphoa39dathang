export interface Product {
  Id: number;
  Code: string;
  Name: string;
  FullName: string;
  Image: string | null;
  BasePrice: number;
  Cost: number;
  OnHand: number;
  OnHandNV?: number;
  Unit: string;
  Description: string;
  CategoryId: number | null;
  CategoryName?: string;
  ConversionValue: number;
  MasterUnitId: number | null;
  MasterProductId: number | null;
  NormalizedName: string;
  NormalizedCode: string;
  isActive: boolean;
  isDeleted: boolean;
  isClone?: boolean;
  CloneOnHandNV?: number;
  ModifiedDate: string;
  ProductAttributes?: ProductAttribute[];
}

export interface ProductAttribute {
  Label: string;
  Value: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPriceSaleOff: number;
  unitPrice?: number;            // giá bán thực tế (sau giảm giá)
  totalPrice?: number;           // unitPrice * quantity

  // Promotion fields (thống nhất với BanHang)
  isGift?: boolean;              // true = hàng tặng, Price=0 khi gửi KiotViet
  isPromotionItem?: boolean;     // true = hàng KM (gift hoặc discounted)
  promotionId?: string;          // ID promotion đã apply
  promotionName?: string;        // tên KM để hiển thị
  parentProductId?: string;      // ID sản phẩm trigger
}

export interface GiftEntry {
  productId: string;
  code?: string;
  name?: string;
  basePrice?: number;
  quantity: number;
}

export interface GiftProduct extends Partial<Product> {
  Id: number;
  Name: string;
  BasePrice: number;
  Image: string | null;
  GiftQuantity: number;
}

export interface Promotion {
  id: string;
  name: string;
  type: 'gift' | 'percentage' | 'fixed_amount'; // backward compat - primary type
  isEnabled: boolean;
  priority: number;

  // Type flags
  hasGift?: boolean;
  hasPercentDiscount?: boolean;
  hasFixedDiscount?: boolean;

  targetProductId: string;
  targetProductCode: string;
  targetProductName: string;
  minQuantity: number;
  discountPercent?: number;
  discountAmount?: number;
  giftProductId?: string;
  giftProductCode?: string;
  giftProductName?: string;
  giftProductBasePrice?: number;
  giftQuantity?: number;
  giftItems?: GiftEntry[];              // multi-gift (Type 1) - chuan hoa boi BE
  giftProducts?: GiftProduct[];         // product data cua gift, kem GiftQuantity
  fromDate: string;
  toDate: string;
  createdDate: string;
  modifiedDate: string;

  // KiotViet sync
  kiotVietCampaignId?: number;
  kiotVietPromotionType?: 5 | 6;
  kiotVietSynced?: boolean;

  // Embedded product data from /promotions/active API
  targetProduct?: Product;
}

export interface ApplyPromotionResult {
  appliedPromotions: AppliedPromotion[];
  giftItems: GiftItem[];
  totalDiscount: number;
}

export interface AppliedPromotion {
  promotionId: string;
  promotionName: string;
  type: string;
  targetProductId: string;
  discountAmount: number;
  discountPercent?: number;
  giftProductId?: string;
  giftProductName?: string;
  giftQuantity?: number;
}

export interface GiftItem {
  productId: string;
  code: string;
  name: string;
  quantity: number;
  basePrice: number;
  isGift: boolean;
  promotionId: string;
}

export interface OrderData {
  id: string;
  customer: {
    Name: string;
    ContactNumber: string;
    Address: string;
  };
  cartItems: CartItem[];
  totalPrice: number;
  totalQuantity: number;
  discountAmount: number;
  customerPaid: number;
  totalCost: number;
  note: string;
  status: 'pending' | 'checked' | 'canceled' | 'edited';
  createdDate: string;
  deliveryTime: string;
  source: 'online';
  appliedPromotions?: AppliedPromotion[];
  wantDelivery: boolean;
  shipCost: number;
  distanceKm: number;
  pointsUsedForShip: number;
  pointsUsedForOrder: number;
  desiredDeliveryDate: string;
  desiredDeliveryTime: string;
  estimatedStartTime: string;
  desiredPickupDate?: string;
  desiredPickupTime?: string;
  lat?: number;
  lng?: number;
}

export interface ShipCostResult {
  shipCost: number;
  freeKm: number;
  ratePerKm: number;
  canShip: boolean;
  message: string;
  heavySurcharge: number;
}

export interface FinalCalculation {
  orderSubtotal: number;
  shipCost: number;
  pointsUsedForShip: number;
  actualShipPayment: number;
  pointsUsedForOrder: number;
  orderAfterDiscount: number;
  finalTotal: number;
  remainingPoints: number;
}
