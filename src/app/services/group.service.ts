import { Injectable } from '@angular/core';
import { Product } from '../models/product';

@Injectable({
  providedIn: 'root'
})
export class GroupService {

  /**
   * Group products by MasterUnitId.
   * Master = MasterUnitId is null/undefined or self-reference (MasterUnitId === Id).
   * Returns Record<masterId, Product[]> where first element is the master.
   */
  group(products: Product[]): Record<number, Product[]> {
    const grouped: Record<number, Product[]> = {};

    // Pass 1: Find all master products
    products.forEach(product => {
      const productId = Number(product.Id);
      const masterUnitId = product.MasterUnitId;

      const isMaster = masterUnitId === null ||
                       masterUnitId === undefined ||
                       Number(masterUnitId) === productId;

      if (isMaster) {
        if (!grouped[productId]) {
          grouped[productId] = [];
        }
        grouped[productId].push(product);
      }
    });

    // Pass 2: Add child products to their respective master groups
    products.forEach(product => {
      const productId = Number(product.Id);
      const masterUnitId = product.MasterUnitId;

      if (masterUnitId === null || masterUnitId === undefined) return;

      const masterId = Number(masterUnitId);
      if (masterId === productId) return;

      if (grouped[masterId]) {
        grouped[masterId].push(product);
      }
    });

    return grouped;
  }
}
