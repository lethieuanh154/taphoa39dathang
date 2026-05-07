import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { ShipCostResult } from '../models/product';

const STORE_LAT = environment.storeLat;
const STORE_LNG = environment.storeLng;

/** Road distance factor: multiply straight-line distance by this to estimate real road distance */
const ROAD_FACTOR = 1.3;
/** Average speed in km/h for estimating travel time in urban area */
const AVG_SPEED_KMH = 25;

@Injectable({ providedIn: 'root' })
export class ShippingService {
  constructor(private http: HttpClient) {}

  /** Geocode address to lat/lng via Nominatim (OpenStreetMap) - free, no API key needed */
  geocodeAddress(address: string): Observable<{ lat: number; lng: number }> {
    let cleaned = this.normalizeAddress(address);
    // Append city/country only if not already present
    const lower = cleaned.toLowerCase();
    if (!/đà\s*nẵng|da\s*nang/.test(lower)) {
      cleaned += ', Đà Nẵng';
    }
    if (!/việt\s*nam|viet\s*nam/.test(lower)) {
      cleaned += ', Việt Nam';
    }
    const query = encodeURIComponent(cleaned);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=vn`;
    return this.http.get<any[]>(url, {
      headers: { 'Accept-Language': 'vi' }
    }).pipe(
      map(results => {
        if (!results?.length) {
          throw new Error('Không tìm thấy địa chỉ ở Đà Nẵng. Vui lòng nhập chi tiết hơn.');
        }
        return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
      })
    );
  }

  /** Strip Vietnamese address prefixes that Nominatim doesn't understand */
  private normalizeAddress(raw: string): string {
    return raw
      .replace(/\b(số|so)\s+/gi, '')
      .replace(/\b(đường|duong)\s+/gi, '')
      .replace(/\b(phường|phuong)\s+/gi, '')
      .replace(/\b(quận|quan)\s+/gi, '')
      .replace(/\b(thành phố|thanh pho|tp\.?)\s+/gi, '')
      .replace(/\b(xã|xa)\s+/gi, '')
      .replace(/\b(huyện|huyen)\s+/gi, '')
      .replace(/\b(thị trấn|thi tran)\s+/gi, '')
      .replace(/\b(khu phố|khu pho)\s+/gi, '')
      .replace(/\b(tổ|to)\s+\d+\s*/gi, '')
      .replace(/,\s*,/g, ',')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate distance using Haversine formula (straight-line) × road factor.
   * No Distance Matrix API needed — no billing required.
   */
  calculateDistance(lat: number, lng: number): Observable<{ distanceKm: number; durationMinutes: number }> {
    const straightKm = this.haversineDistance(STORE_LAT, STORE_LNG, lat, lng);
    const roadKm = straightKm * ROAD_FACTOR;
    // Round up to 0.1km
    const distanceKm = Math.ceil(roadKm * 10) / 10;
    // Estimate travel time based on average urban speed
    const durationMinutes = Math.ceil((roadKm / AVG_SPEED_KMH) * 60);
    return of({ distanceKm, durationMinutes });
  }

  /** Haversine formula: straight-line distance between two lat/lng points in km */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(this.toRad(lat1)) * 
      Math.cos(this.toRad(lat2)) * 
      Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /** Calculate shipping cost based on order subtotal and distance */
  calculateShipCost(orderSubtotal: number, distanceKm: number): ShipCostResult {
    if (orderSubtotal < 200000) {
      return { shipCost: 0, freeKm: 0, ratePerKm: 0, canShip: false, message: 'Đơn tối thiểu 200.000đ để giao hàng' };
    }

    let freeKm = 0;
    let ratePerKm = 0;

    if (orderSubtotal < 500000) {
      freeKm = 0;
      ratePerKm = 13000;
    } else if (orderSubtotal < 1000000) {
      freeKm = 2;
      ratePerKm = 7000;
    } else if (orderSubtotal < 2000000) {
      freeKm = 3;
      ratePerKm = 6000;
    } else if (orderSubtotal < 10000000){
      freeKm = 5;
      ratePerKm = 6000;
    } else {
      freeKm = 7;
      ratePerKm = 5000;
    }

    const chargeableKm = Math.max(0, distanceKm - freeKm);
    const rawCost = chargeableKm * ratePerKm;

    const shipCost = Math.round(rawCost / 1000) * 1000;

    return { shipCost, freeKm, ratePerKm, canShip: true, message: '' };
  }

  /**
   * Calculate delivery time slot based on when the order is placed.
   * Working hours: 08:00 - 17:00. Prep time: 30 min.
   *
   * - Order 00:00-07:59 (ngoài giờ sáng) → giao 08:30-10:00 cùng ngày
   * - Order 08:00-11:29 → giao 10:30-12:00 cùng ngày
   * - Order 11:30-14:59 → giao 14:30-16:00 cùng ngày
   * - Order 15:00-16:29 → giao 16:30-17:00 cùng ngày
   * - Order 16:30-23:59 (ngoài giờ chiều) → giao 08:30-10:00 ngày hôm sau
   *
   * Thời gian chính xác hơn sẽ được cập nhật từ Management khi tối ưu lộ trình.
   */
  calculateDeliveryTimeSlot(orderTime: Date): { date: string; timeSlot: string; startTime: string; endTime: string } {
    const h = orderTime.getHours();
    const m = orderTime.getMinutes();
    const totalMin = h * 60 + m;
    const toLocalDateStr = (d: Date) => {
      const y = d.getFullYear();
      const mo = (d.getMonth() + 1).toString().padStart(2, '0');
      const da = d.getDate().toString().padStart(2, '0');
      return `${y}-${mo}-${da}`;
    };

    // Ngoài giờ sáng (trước 08:00) → giao 08:30-10:00 cùng ngày
    if (totalMin < 480) {
      return { date: toLocalDateStr(orderTime), timeSlot: '08:30 - 10:00', startTime: '08:30', endTime: '10:00' };
    }
    // 08:00-11:29 → giao 10:30-12:00
    if (totalMin < 690) {
      return { date: toLocalDateStr(orderTime), timeSlot: '10:30 - 12:00', startTime: '10:30', endTime: '12:00' };
    }
    // 11:30-14:59 → giao 14:30-16:00
    if (totalMin < 900) {
      return { date: toLocalDateStr(orderTime), timeSlot: '14:30 - 16:00', startTime: '14:30', endTime: '16:00' };
    }
    // 15:00-16:29 → giao 16:30-17:00
    if (totalMin < 990) {
      return { date: toLocalDateStr(orderTime), timeSlot: '16:30 - 17:00', startTime: '16:30', endTime: '17:00' };
    }
    // 16:30-23:59 (ngoài giờ chiều) → giao 08:30-10:00 ngày hôm sau
    const nextDay = new Date(orderTime);
    nextDay.setDate(nextDay.getDate() + 1);
    return { date: toLocalDateStr(nextDay), timeSlot: '08:30 - 10:00', startTime: '08:30', endTime: '10:00' };
  }
}
