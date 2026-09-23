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

/** Tên cấp tỉnh/thành — KHÔNG được tính là khớp phường (xem matchesWard) */
const PROVINCE_NAMES = new Set(['da nang', 'quang nam', 'tp da nang']);

/** Trần nâng khoảng cách khi khớp ĐƯỢC CẢ phường (km) — đã chắc đúng đường, chỉ chưa rõ vị trí dọc đường */
const MAX_UPLIFT_WARD_KM = 2.0;
/** Trần nâng khi CHỈ khớp tên đường (km) — phải chặt vì Đà Nẵng sau sáp nhập có nhiều đường trùng tên */
const MAX_UPLIFT_STREET_KM = 1.0;

interface GeoCandidate {
  lat: number;
  lng: number;
  /** Khoảng cách chim bay từ cửa hàng (km) */
  dist: number;
  streetMatched: boolean;
  wardMatched: boolean;
}

/** Đơn tối thiểu để được giao hàng */
const MIN_DELIVERY_SUBTOTAL = 200000;

/** Hàng thùng nặng — dùng cho chiết khấu sỉ khi khách tự đến lấy */
const HEAVY_PATTERN = /\b(bia|nước suối|nước khoáng|sữa|nước ngọt|nước tăng lực|nước giải khát)\b/i;
/** Phải NHIỀU HƠN mức này mới được chiết khấu sỉ */
const BULK_DISCOUNT_MIN_CASES = 10;
/** đ/thùng, chỉ khi khách tự đến lấy hàng */
const BULK_DISCOUNT_PER_CASE = 2000;

@Injectable({ providedIn: 'root' })
export class ShippingService {
  constructor(private http: HttpClient) {}

  /**
   * Geocode địa chỉ → MỘT toạ độ (Nominatim chỉ chạy khi Photon rỗng).
   * Hệ thống tự chọn vị trí theo 3 tầng tin cậy trong pickCandidate() — xem chú thích ở đó.
   */
  geocodeAddress(address: string): Observable<{ lat: number; lng: number }> {
    const cleaned = this.normalizeAddress(address);
    let query = cleaned;
    const lower = query.toLowerCase();
    if (!/đà\s*nẵng|da\s*nang/.test(lower)) query += ', Đà Nẵng';
    const normalizedQuery = this.normalizeForMatch(query);

    return this.photonSearch(query, normalizedQuery).pipe(
      switchMap(found => {
        if (found.length) return of(found);
        let full = query;
        if (!/việt\s*nam|viet\s*nam/.test(full.toLowerCase())) full += ', Việt Nam';
        return this.nominatimFreeform(full).pipe(
          map(r => this.nominatimCandidates(r, normalizedQuery))
        );
      }),
      map(found => {
        const best = this.pickCandidate(found);
        if (!best) {
          throw new Error('Không tìm thấy địa chỉ. Vui lòng thêm dấu phẩy giữa số nhà, đường, phường (VD: 120, Núi Thành, Hòa Cường, Đà Nẵng).');
        }
        return { lat: best.lat, lng: best.lng };
      })
    );
  }

  /** Bỏ dấu tiếng Việt + hạ chữ thường để so khớp tên đường */
  private normalizeForMatch(raw: string): string {
    return (raw || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Một trường bất kỳ (đường/tên) có xuất hiện trong địa chỉ khách nhập không */
  private matchesAny(fields: (string | null | undefined)[], normalizedQuery: string): boolean {
    for (const field of fields) {
      const t = this.stripPrefixes(this.normalizeForMatch(field || ''));
      if (t.length > 4 && normalizedQuery.includes(t)) return true;
    }
    return false;
  }

  /**
   * Khớp PHƯỜNG/XÃ. Bỏ qua các giá trị cấp tỉnh/thành: geocoder luôn trả `city = "Đà Nẵng"`
   * mà mọi truy vấn cũng luôn kết thúc bằng "Đà Nẵng", nên nếu tính cả chúng thì ứng viên nào
   * cũng "khớp phường" — tầng B sụp vào tầng A và ăn nhầm trần 2km.
   * Lỗi thật đã gặp: "28 Lê Trọng Tấn, Hoà An" lấy nhầm Lê Trọng Tấn ở Hoà Khánh (5,4km/thực 2,5km).
   */
  private matchesWard(fields: (string | null | undefined)[], normalizedQuery: string): boolean {
    for (const field of fields) {
      const t = this.stripPrefixes(this.normalizeForMatch(field || ''));
      if (t.length <= 4 || PROVINCE_NAMES.has(t)) continue;
      if (normalizedQuery.includes(t)) return true;
    }
    return false;
  }

  /** Bỏ tiền tố hành chính để so khớp phần tên thuần */
  private stripPrefixes(t: string): string {
    for (const prefix of ['duong ', 'hem ', 'kiet ', 'pho ', 'so ', 'phuong ', 'quan ', 'xa ', 'thanh pho ']) {
      t = t.split(prefix).join('');
    }
    return t;
  }

  /**
   * Chọn toạ độ theo 3 tầng tin cậy. Trong mỗi tầng lấy điểm XA NHẤT (sai số nghiêng về
   * phía tính dư: tính thiếu thì cửa hàng lỗ mỗi chuyến, tính dư chỉ mất một đơn ở mép),
   * chặn bằng một trần so với ứng viên đầu tầng.
   *
   * - Tầng A: khớp CẢ tên đường VÀ phường → trần +2km. Đã chắc đúng đường, phần dư chỉ là
   *   vị trí dọc theo đường đó.
   * - Tầng B: chỉ khớp tên đường → trần +1km. PHẢI chặt: Đà Nẵng sau khi sáp nhập Quảng Nam
   *   có nhiều đường trùng tên khác phường. Ví dụ thật: "28 Lê Trọng Tấn, Hoà An" trả về cả
   *   Lê Trọng Tấn ở An Khê (2,16km) lẫn Lê Trọng Tấn ở Hoà Khánh (4,09km) — trần 1km loại
   *   đúng cái sai, trần 2km thì lấy nhầm nó.
   * - Tầng C: không khớp gì → lấy kết quả ĐẦU TIÊN (geocoder đã xếp theo độ khớp).
   *   Tuyệt đối không lấy xa nhất ở tầng này: mọi ứng viên đều có thể sai, max sẽ tóm
   *   phải cái sai xa nhất (vd "120 Núi Thành, Hải Châu" → "Đường Thành Điện Hải").
   *
   * KHÔNG BAO GIỜ chọn theo "gần cửa hàng nhất" — lỗi cũ khiến địa điểm sai tên nhưng gần hơn
   * luôn thắng ("08 Phan Đình Phùng" ra Phan Châu Trinh: 6,2km thay vì 8,1km, thực tế 8,0km).
   */
  private pickCandidate(candidates: GeoCandidate[]): GeoCandidate | null {
    if (!candidates.length) return null;

    const tiers: { pool: GeoCandidate[]; uplift: number }[] = [
      { pool: candidates.filter(c => c.streetMatched && c.wardMatched), uplift: MAX_UPLIFT_WARD_KM },
      { pool: candidates.filter(c => c.streetMatched && !c.wardMatched), uplift: MAX_UPLIFT_STREET_KM },
    ];

    for (const tier of tiers) {
      if (!tier.pool.length) continue;
      const limit = tier.pool[0].dist + tier.uplift;
      let best = tier.pool[0];
      for (const c of tier.pool) {
        if (c.dist <= limit && c.dist > best.dist) best = c;
      }
      return best;
    }

    return candidates[0];
  }

  /** Photon geocoder — trả về MỌI ứng viên trong vùng, giữ nguyên thứ tự xếp hạng của Photon */
  private photonSearch(query: string, normalizedQuery: string): Observable<GeoCandidate[]> {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lat=${STORE_LAT}&lon=${STORE_LNG}`;
    return this.http.get<any>(url).pipe(
      map(res => {
        const candidates: GeoCandidate[] = [];
        for (const f of res?.features || []) {
          const coords = f.geometry?.coordinates;
          if (!coords) continue;
          const lng = coords[0];
          const lat = coords[1];
          const dist = this.haversineDistance(STORE_LAT, STORE_LNG, lat, lng);
          if (dist > MAX_GEOCODE_KM) continue;
          const p = f.properties || {};
          candidates.push({
            lat, lng, dist,
            streetMatched: this.matchesAny([p.street, p.name], normalizedQuery),
            wardMatched: this.matchesWard([p.district, p.county, p.city], normalizedQuery),
          });
        }
        return candidates;
      })
    );
  }

  /** Nominatim fallback — cùng quy tắc, chỉ chạy khi Photon không trả ứng viên nào */
  private nominatimCandidates(results: any[] | null, normalizedQuery: string): GeoCandidate[] {
    const candidates: GeoCandidate[] = [];
    for (const r of results || []) {
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      if (isNaN(lat) || isNaN(lng)) continue;
      const dist = this.haversineDistance(STORE_LAT, STORE_LNG, lat, lng);
      if (dist > MAX_GEOCODE_KM) continue;
      const parts = (r.display_name || '').split(',').map((x: string) => x.trim());
      candidates.push({
        lat, lng, dist,
        streetMatched: this.matchesAny(parts.slice(0, 2), normalizedQuery),
        wardMatched: this.matchesWard(parts.slice(2, 5), normalizedQuery),
      });
    }
    return candidates;
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

  /** Calculate shipping cost based on order subtotal and distance.
   *  Không còn phụ phí hàng nặng — hàng thùng được xử lý bằng chiết khấu sỉ khi tự đến lấy. */
  calculateShipCost(orderSubtotal: number, distanceKm: number): ShipCostResult {
    if (orderSubtotal < MIN_DELIVERY_SUBTOTAL) {
      return { shipCost: 0, freeKm: 0, ratePerKm: 0, minChargeableKm: 0, canShip: false, message: 'Đơn tối thiểu 200.000đ để giao hàng' };
    }

    let freeKm = 0;
    let ratePerKm = 0;
    let minChargeableKm = 0;

    if (orderSubtotal < 500000) {
      freeKm = 0;
      ratePerKm = 13000;
      minChargeableKm = 1;   // tính tối thiểu 1km
    } else if (orderSubtotal < 1000000) {
      freeKm = 1;
      ratePerKm = 6000;
    } else if (orderSubtotal < 2000000) {
      freeKm = 2;
      ratePerKm = 5000;
    } else if (orderSubtotal < 5000000) {
      freeKm = 3;
      ratePerKm = 5000;
    } else if (orderSubtotal < 10000000) {
      freeKm = 5;
      ratePerKm = 5000;
    } else {
      freeKm = 8;
      ratePerKm = 4000;
    }

    const chargeableKm = Math.max(minChargeableKm, distanceKm - freeKm);
    const shipCost = Math.round(chargeableKm * ratePerKm / 1000) * 1000;

    return { shipCost, freeKm, ratePerKm, minChargeableKm, canShip: true, message: '' };
  }

  /** Tổng số thùng hàng nặng (bia, nước suối, sữa, nước ngọt...) trong giỏ */
  countHeavyCases(items: CartItem[]): number {
    let totalCases = 0;
    for (const item of items) {
      if (item.isGift) continue;
      if (item.product.Unit?.toLowerCase() === 'thùng' && HEAVY_PATTERN.test(item.product.FullName || item.product.Name)) {
        totalCases += item.quantity;
      }
    }
    return totalCases;
  }

  /**
   * Chiết khấu sỉ khi khách TỰ ĐẾN LẤY hàng: trên 10 thùng hàng nặng → 2.000đ/thùng.
   * KHÔNG áp dụng cho đơn giao hàng — giá sỉ là giá tại cửa hàng.
   */
  calculatePickupBulkDiscount(items: CartItem[]): number {
    const cases = this.countHeavyCases(items);
    if (cases <= BULK_DISCOUNT_MIN_CASES) return 0;
    return cases * BULK_DISCOUNT_PER_CASE;
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
