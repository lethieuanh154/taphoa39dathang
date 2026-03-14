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
  ConversionValue: number;
  MasterUnitId: number | null;
  MasterProductId: number | null;
  NormalizedName: string;
  NormalizedCode: string;
  isActive: boolean;
  isDeleted: boolean;
  isClone?: boolean;
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
  paymentMethod: 'cod' | 'transfer';
}
