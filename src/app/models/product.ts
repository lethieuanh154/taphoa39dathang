export interface Product {
    Image: string;
    Code: string;
    FullName: string;
    AverageCheckPoint: false,
    BasePrice: number;
    FinalBasePrice: number,
    OnHand: number;
    Cost: number;
    PackCost: number;
    OriginalBoxPrice: number;
    Description: string;
    Unit: string;
    PackingSpec: number;
    UnitSpec: number;
    Retail: number;
    Box: number;
    Discount: number;
    Discount2: number;
    TotalPrice: number;
    ListProduct: ListProductUnit[];
    ConversionValue: number;
    GroupName: string;
    Edited: boolean;
    Master: boolean;
    Id: number,
    discountBasePrice?: number;
}


export interface ListProductUnit {
  Code: any;
  Conversion: any;
  Id: any;
  MasterUnitId: any;
  Unit: any;
}
