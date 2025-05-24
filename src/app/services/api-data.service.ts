import { Injectable } from '@angular/core';
import { Product } from '../models/product';
import { environment } from '../../environments/environment';
import { map, catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiDataService {

  constructor() { }

  fetchFromAPI(
    http: any,
    searchTerm: string,
    filteredProducts: Product[],
    isLoading: boolean,
    loadData: (data: Product[]) => void
  ) {
    isLoading = true;
    const st = searchTerm.replace(/ /g, '_');

    http.get(`${environment.domainUrl}/api/item/${searchTerm}`).pipe(
      map((data: any[]) => {
            console.log(data);
        const products = this.transformApiData(data);

        const cacheKey = `search_${st}`;
        localStorage.setItem(cacheKey, JSON.stringify(products));

        return products;
      }),
      catchError((err) => {
        console.error('❌ Lỗi khi tìm kiếm:', err);
        isLoading = false;
        return of([]);
      })
    ).subscribe((products: Product[]) => {
      filteredProducts = products;

      // Apply colors and sorting


      isLoading = false;
      loadData(filteredProducts);
    });
  }

  private transformApiData(data: any[]): Product[] {
    return data.map(item => ({
      Image: item.Image,
      Code: item.Code,
      FullName: item.Name,
      AverageCheckPoint: item.AverageCheckPoint || false,
      BasePrice: item.BasePrice || 0,
      FinalBasePrice: item.FinalBasePrice || 0,
      OnHand: item.OnHand || 0,
      Cost: item.Cost || 0,
      PackCost: item.PackCost || 0,
      OriginalBoxPrice: item.OriginalBoxPrice || 0,
      Description: item.Description ? item.Description.replace(/<\/?[^>]+(>|$)/g, '') : '',
      Unit: item.Unit || '',
      PackingSpec: item.PackingSpec || 0,
      UnitSpec: item.UnitSpec || 0,
      Retail: item.Retail || 0,
      Box: item.Box || 0,
      Discount: item.Discount || 0,
      Discount2: item.Discount2 || 0,
      TotalPrice: item.TotalPrice || 0,
      ListProduct: item.ListProductUnit || 0,
      ConversionValue: item.ConversionValue || 0,
      GroupName: item.Name,
      Edited: false,
      Master: false,
      Id: item.Id,

      // Add missing Product properties with default values
      ActualReserved: item.ActualReserved || 0,
      AllowsSale: item.AllowsSale !== undefined ? item.AllowsSale : true,
      AttributeLabel: item.AttributeLabel || '',
      CategoryId: item.CategoryId || '',
      CategoryName: item.CategoryName || '',
      CreatedDate: item.CreatedDate || '',
      IsActive: item.IsActive !== undefined ? item.IsActive : true,
      IsCombo: item.IsCombo !== undefined ? item.IsCombo : false,
      IsDeleted: item.IsDeleted !== undefined ? item.IsDeleted : false,
      IsSerial: item.IsSerial !== undefined ? item.IsSerial : false,
      ModifiedDate: item.ModifiedDate || '',
      ParentId: item.ParentId || '',
      Price: item.Price || 0,
      ProductType: item.ProductType || '',
      PromotionPrice: item.PromotionPrice || 0,
      Sku: item.Sku || '',
      StockId: item.StockId || '',
      SupplierId: item.SupplierId || '',
      SupplierName: item.SupplierName || '',

      // Add the missing properties from Product type with default values
      HasSerialOrBatchExpireInfo: item.HasSerialOrBatchExpireInfo !== undefined ? item.HasSerialOrBatchExpireInfo : false,
      HasVariants: item.HasVariants !== undefined ? item.HasVariants : false,
      IsBatchExpireControl: item.IsBatchExpireControl !== undefined ? item.IsBatchExpireControl : false,
      IsLotSerialControl: item.IsLotSerialControl !== undefined ? item.IsLotSerialControl : false,
      IsStockNegativeAllowed: item.IsStockNegativeAllowed !== undefined ? item.IsStockNegativeAllowed : false,
      IsStockTracking: item.IsStockTracking !== undefined ? item.IsStockTracking : false,
      MinStock: item.MinStock || 0,
      MaxStock: item.MaxStock || 0,
      ProductGroupId: item.ProductGroupId || '',
      ProductGroupName: item.ProductGroupName || '',
      ProductUnitId: item.ProductUnitId || '',
      ProductUnitName: item.ProductUnitName || '',
      Barcode: item.Barcode || '',
      Brand: item.Brand || ''
    }));
  }
}
