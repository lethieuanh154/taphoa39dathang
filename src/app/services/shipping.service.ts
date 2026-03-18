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
    const query = encodeURIComponent(address + ', Đà Nẵng, Việt Nam');
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=vn`;
    return this.http.get<any[]>(url, {
      headers: { 'Accept-Language': 'vi' }
    }).pipe(
      map(results => {
        if (!results?.length) {
          throw new Error('Không tìm thấy địa chỉ. Vui lòng nhập chi tiết hơn.');
        }
        return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
      })
    );
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
      + Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) ** 2;
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
      ratePerKm = 10000;
      freeKm = 0;
    } else if (orderSubtotal < 700000) {
      freeKm = 3;
      ratePerKm = 5000;
    } else if (orderSubtotal < 1000000) {
      freeKm = 5;
      ratePerKm = 5000;
    } else {
      freeKm = 10;
      ratePerKm = 5000;
    }

    let rawCost: number;
    if (orderSubtotal < 500000) {
      rawCost = distanceKm * ratePerKm;
    } else {
      const chargeableKm = Math.max(0, distanceKm - freeKm);
      rawCost = chargeableKm * ratePerKm;
    }

    const shipCost = Math.round(rawCost / 1000) * 1000;

    return { shipCost, freeKm, ratePerKm, canShip: true, message: '' };
  }

  /** Calculate estimated departure time: desiredTime - travelDuration */
  calculateStartTime(desiredTime: string, durationMinutes: number): string {
    if (!desiredTime) return '';
    const [h, m] = desiredTime.split(':').map(Number);
    const desiredMinutes = h * 60 + m;
    const startMinutes = desiredMinutes - durationMinutes;
    if (startMinutes < 0) return '00:00';
    const sh = Math.floor(startMinutes / 60);
    const sm = startMinutes % 60;
    return `${sh.toString().padStart(2, '0')}:${sm.toString().padStart(2, '0')}`;
  }
}
