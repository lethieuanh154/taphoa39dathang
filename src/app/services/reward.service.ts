import { Injectable } from '@angular/core';
import { FinalCalculation } from '../models/product';

const GIFT_POINT_KEY = 'sm_customer_giftpoint';

@Injectable({ providedIn: 'root' })
export class RewardService {

  getAvailablePoints(): number {
    const val = localStorage.getItem(GIFT_POINT_KEY);
    return val ? Number(val) || 0 : 0;
  }

  calculateShipDiscount(availablePoints: number, shipCost: number): { pointsUsed: number; actualPayment: number } {
    const pointsUsed = Math.min(availablePoints, shipCost);
    return { pointsUsed, actualPayment: shipCost - pointsUsed };
  }

  calculateOrderDiscount(availablePoints: number, pointsUsedForShip: number, orderSubtotal: number): { pointsUsed: number; orderAfterDiscount: number } {
    const remaining = Math.max(0, availablePoints - pointsUsedForShip);
    const pointsUsed = Math.min(remaining, orderSubtotal);
    return { pointsUsed, orderAfterDiscount: orderSubtotal - pointsUsed };
  }

  calculateFinal(
    orderSubtotal: number,
    shipCost: number,
    usePointsForShip: boolean,
    usePointsForOrder: boolean,
    bulkDiscount: number = 0
  ): FinalCalculation {
    const availablePoints = this.getAvailablePoints();
    // Chiet khau si chi ap dung khi khach tu den lay -> tru truoc khi tinh diem
    const cappedBulkDiscount = Math.min(Math.max(0, bulkDiscount), orderSubtotal);
    const subtotalAfterBulk = orderSubtotal - cappedBulkDiscount;

    let pointsUsedForShip = 0;
    let actualShipPayment = shipCost;
    if (usePointsForShip && shipCost > 0) {
      const shipDiscount = this.calculateShipDiscount(availablePoints, shipCost);
      pointsUsedForShip = shipDiscount.pointsUsed;
      actualShipPayment = shipDiscount.actualPayment;
    }

    let pointsUsedForOrder = 0;
    let orderAfterDiscount = subtotalAfterBulk;
    if (usePointsForOrder) {
      const orderDiscount = this.calculateOrderDiscount(availablePoints, pointsUsedForShip, subtotalAfterBulk);
      pointsUsedForOrder = orderDiscount.pointsUsed;
      orderAfterDiscount = orderDiscount.orderAfterDiscount;
    }

    const finalTotal = orderAfterDiscount + actualShipPayment;
    const remainingPoints = availablePoints - pointsUsedForShip - pointsUsedForOrder;

    return {
      orderSubtotal,
      bulkDiscount: cappedBulkDiscount,
      subtotalAfterBulk,
      shipCost,
      pointsUsedForShip,
      actualShipPayment,
      pointsUsedForOrder,
      orderAfterDiscount,
      finalTotal,
      remainingPoints
    };
  }
}
