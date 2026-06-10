import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { CartItem, ShipCostResult } from '../models/product';

const STORE_LAT = environment.storeLat;
const STORE_LNG = environment.storeLng;

/** Đà Nẵng bounding box for Nominatim viewbox (lon1,lat1,lon2,lat2) */
const DA_NANG_VIEWBOX = '108.10,16.12,108.28,15.96';

/** Bán kính tối đa (km) chấp nhận kết quả geocoding — loại bỏ kết quả ngoài Đà Nẵng */
const MAX_GEOCODE_KM = 15;

/** Road distance factor: multiply straight-line distance by this to estimate real road distance */
const ROAD_FACTOR = 1.3;
/** Average speed in km/h for estimating travel time in urban area */
const AVG_SPEED_KMH = 25;

@Injectable({ providedIn: 'root' })
export class ShippingService {
  constructor(private http: HttpClient) {}

  /** Geocode address to lat/lng — Photon (fuzzy match + location bias) → Nominatim fallback */
  geocodeAddress(address: string): Observable<{ lat: number; lng: number }> {
    const cleaned = this.normalizeAddress(address);
    let query = cleaned;
    const lower = query.toLowerCase();
    if (!/đà\s*nẵng|da\s*nang/.test(lower)) query += ', Đà Nẵng';

    // Try 1: Photon — fuzzy matching, chọn kết quả gần cửa hàng nhất
    return this.photonSearch(query).pipe(
      switchMap(best => {
        if (best) return of(best);
        // Try 2: Nominatim free-form fallback
        let full = query;
        if (!/việt\s*nam|viet\s*nam/.test(full.toLowerCase())) full += ', Việt Nam';
        return this.nominatimFreeform(full).pipe(
          map(r => this.pickClosestNominatim(r))
        );
      }),
      map(best => {
        if (!best) {
          throw new Error('Không tìm thấy địa chỉ. Vui lòng thêm dấu phẩy giữa số nhà, đường, phường, quận (VD: 120, Phan Trọng Tuệ, Hòa Cường, Đà Nẵng).');
        }
        return best;
      })
    );
  }

  /** Photon geocoder — fuzzy match + location bias gần cửa hàng */
  private photonSearch(query: string): Observable<{ lat: number; lng: number } | null> {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lat=${STORE_LAT}&lon=${STORE_LNG}`;
    return this.http.get<any>(url).pipe(
      map(res => {
        const features = res?.features;
        if (!features?.length) return null;
        let bestDist = Infinity;
        let best: { lat: number; lng: number } | null = null;
        for (const f of features) {
          const coords = f.geometry?.coordinates;
          if (!coords) continue;
          const lng = coords[0];
          const lat = coords[1];
          const dist = this.haversineDistance(STORE_LAT, STORE_LNG, lat, lng);
          if (dist < bestDist && dist <= MAX_GEOCODE_KM) {
            bestDist = dist;
            best = { lat, lng };
          }
        }
        return best;
      })
    );
  }

  /** Chọn kết quả Nominatim gần cửa hàng nhất trong phạm vi MAX_GEOCODE_KM */
  private pickClosestNominatim(results: any[] | null): { lat: number; lng: number } | null {
    if (!results?.length) return null;
    let bestDist = Infinity;
    let best: { lat: number; lng: number } | null = null;
    for (const r of results) {
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      if (isNaN(lat) || isNaN(lng)) continue;
      const dist = this.haversineDistance(STORE_LAT, STORE_LNG, lat, lng);
      if (dist < bestDist && dist <= MAX_GEOCODE_KM) {
        bestDist = dist;
        best = { lat, lng };
      }
    }
    return best;
  }

  /** Nominatim free-form fallback */
  private nominatimFreeform(query: string): Observable<any[]> {
    return this.http.get<any[]>(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=vn&viewbox=${DA_NANG_VIEWBOX}`,
      { headers: { 'Accept-Language': 'vi' } }
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
      .replace(/^(\d+)\s*,\s*/, '$1 ')   // "120, Phan Trọng Tuệ" → "120 Phan Trọng Tuệ"
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
  calculateShipCost(orderSubtotal: number, distanceKm: number, items: CartItem[] = []): ShipCostResult {
    if (orderSubtotal < 200000) {
      return { shipCost: 0, freeKm: 0, ratePerKm: 0, canShip: false, message: 'Đơn tối thiểu 200.000đ để giao hàng', heavySurcharge: 0 };
    }

    let freeKm = 0;
    let ratePerKm = 0;

    if (orderSubtotal < 500000) {
      freeKm = 0;
      ratePerKm = 12000;
    } else if (orderSubtotal < 1000000) {
      freeKm = 2;
      ratePerKm = 6000;
    } else if (orderSubtotal < 2000000) {
      freeKm = 3;
      ratePerKm = 5000;
    } else if (orderSubtotal < 10000000){
      freeKm = 5;
      ratePerKm = 5000;
    } else {
      freeKm = 7;
      ratePerKm = 4000;
    }

    const chargeableKm = Math.max(0, distanceKm - freeKm);
    const rawCost = chargeableKm * ratePerKm;
    const shipCost = Math.round(rawCost / 1000) * 1000;
    const heavySurcharge = this.calculateHeavySurcharge(items);

    return { shipCost: shipCost + heavySurcharge, freeKm, ratePerKm, canShip: true, message: '', heavySurcharge };
  }

  /** Calculate surcharge for heavy bulk items (thùng bia, nước suối, sữa, nước ngọt) */
  calculateHeavySurcharge(items: CartItem[]): number {
    const heavyPattern = /\b(bia|nước suối|nước khoáng|sữa|nước ngọt|nước tăng lực|nước giải khát)\b/i;
    let totalCases = 0;
    for (const item of items) {
      if (item.product.Unit?.toLowerCase() === 'thùng' && heavyPattern.test(item.product.FullName || item.product.Name)) {
        totalCases += item.quantity;
      }
    }
    if (totalCases > 20) return 100000;
    if (totalCases > 10) return 50000;
    if (totalCases > 5) return 20000;
    return 0;
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
