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
}

export interface ShipCostResult {
  shipCost: number;
  freeKm: number;
  ratePerKm: number;
  canShip: boolean;
  message: string;
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
