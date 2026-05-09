import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ChangeDetectionStrategy, ChangeDetectorRef,
  ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import { DeliveryTrackingService, DeliveryTrackingDoc } from '../../services/delivery-tracking.service';
import { environment } from '../../../environments/environment';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface DisplayStatus {
  label: string;
  color: string;
  step: number; // 0=preparing,1=picking,2=picked,3=transit,4=arrived,5=delivered,-1=failed
}

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-tracking.component.html',
  styleUrls: ['./order-tracking.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderTrackingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl') mapEl!: ElementRef;

  orderId = '';
  tracking: DeliveryTrackingDoc | null = null;
  displayStatus: DisplayStatus = { label: 'Đang chuẩn bị hàng', color: '#9C27B0', step: 0 };

  private map: L.Map | null = null;
  private destMarker: L.Marker | null = null;
  private driverMarker: L.Marker | null = null;
  private myMarker: L.Marker | null = null;
  private routeLine: L.Polyline | null = null;
  private sub: Subscription | null = null;

  readonly steps = ['Chuẩn bị', 'Lấy hàng', 'Đã lấy', 'Đang đi', 'Đã đến', 'Đã giao'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private trackingService: DeliveryTrackingService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.orderId = this.route.snapshot.paramMap.get('orderId') || '';
    console.log('[Tracking] ngOnInit, orderId:', this.orderId);
    if (!this.orderId) return;

    this.sub = this.trackingService.listenToTracking(this.orderId).subscribe(doc => {
      console.log('[Tracking] subscribe fired, doc:', doc ? `status=${doc.status} customerLat=${doc.customerLat}` : 'NULL', 'mapExists:', !!this.map);
      this.tracking = doc;
      this.displayStatus = doc
        ? this.computeStatus(doc)
        : { label: 'Đang chuẩn bị hàng', color: '#9C27B0', step: 0 };
      this.cdr.markForCheck();

      if (this.map && doc) {
        this.refreshMap(doc);
      }
    });

    this.requestMyLocation();
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.map?.remove();
    this.map = null;
  }

  goBack(): void {
    try {
      const history = localStorage.getItem('sm_order_history');
      if (history && JSON.parse(history).length > 0) {
        this.router.navigate(['/don-hang-cua-toi']);
        return;
      }
    } catch {}
    this.router.navigate(['/']);
  }

  private computeStatus(doc: DeliveryTrackingDoc): DisplayStatus {
    if (doc.status === 'delivered') return { label: 'Đã giao hàng', color: '#4CAF50', step: 5 };
    if (doc.status === 'failed')   return { label: 'Giao thất bại', color: '#9E9E9E', step: -1 };

    if (doc.driverLat == null || doc.driverLng == null) {
      return { label: 'Đang lấy hàng', color: '#FF9800', step: 1 };
    }

    const totalDist = this.haversine(doc.storeLat, doc.storeLng, doc.customerLat, doc.customerLng);
    const remaining = totalDist > 0
      ? this.haversine(doc.driverLat, doc.driverLng, doc.customerLat, doc.customerLng) / totalDist
      : 0;

    if (remaining > 0.9) return { label: 'Đang lấy hàng', color: '#FF9800', step: 1 };
    if (remaining > 0.8) return { label: 'Đã lấy hàng', color: '#FFC107', step: 2 };
    if (remaining > 0.1) return { label: 'Đang đi giao', color: '#2196F3', step: 3 };
    return { label: 'Tài xế đã đến', color: '#F44336', step: 4 };
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private initMap(): void {
    if (!this.mapEl?.nativeElement) {
      console.error('[Tracking] initMap ABORTED — mapEl not available');
      return;
    }
    const storeLat = (environment as any).storeLat ?? 16.019693;
    const storeLng = (environment as any).storeLng ?? 108.197694;

    this.map = L.map(this.mapEl.nativeElement, {
      center: [storeLat, storeLng],
      zoom: 13,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(this.map);

    const storeIcon = L.divIcon({
      html: `<div style="background:#E91E63;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid #fff;">🏪</div>`,
      className: '', iconSize: [30, 30], iconAnchor: [15, 15]
    });
    L.marker([storeLat, storeLng], { icon: storeIcon })
      .addTo(this.map)
      .bindPopup('<strong>Cửa hàng Song Minh</strong>');

    this.showDestFromHistory();
  }

  private showDestFromHistory(): void {
    if (!this.map || !this.orderId) return;
    try {
      const history: any[] = JSON.parse(localStorage.getItem('sm_order_history') || '[]');
      const entry = history.find((e: any) => e.orderId === this.orderId);
      if (entry?.customerLat && entry?.customerLng) {
        const destIcon = L.divIcon({
          html: `<div style="background:#1976D2;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid #fff;">📦</div>`,
          className: '', iconSize: [30, 30], iconAnchor: [15, 15]
        });
        this.destMarker = L.marker([entry.customerLat, entry.customerLng], { icon: destIcon })
          .addTo(this.map!).bindPopup('<strong>Địa chỉ giao hàng của bạn</strong>');

        const storeLat = (environment as any).storeLat ?? 16.019693;
        const storeLng = (environment as any).storeLng ?? 108.197694;
        const bounds = L.latLngBounds([[storeLat, storeLng], [entry.customerLat, entry.customerLng]]);
        this.map!.fitBounds(bounds, { padding: [40, 40] });
      }
    } catch {}
  }

  private refreshMap(doc: DeliveryTrackingDoc): void {
    if (!this.map) {
      console.warn('[Tracking] refreshMap SKIPPED — map is null');
      return;
    }
    console.log('[Tracking] refreshMap, customerLat:', doc.customerLat, 'customerLng:', doc.customerLng, 'driverLat:', doc.driverLat, 'driverLng:', doc.driverLng);

    if (doc.customerLat && doc.customerLng) {
      const destIcon = L.divIcon({
        html: `<div style="background:#1976D2;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid #fff;">📦</div>`,
        className: '', iconSize: [30, 30], iconAnchor: [15, 15]
      });
      if (!this.destMarker) {
        this.destMarker = L.marker([doc.customerLat, doc.customerLng], { icon: destIcon })
          .addTo(this.map!).bindPopup('<strong>Địa chỉ giao hàng của bạn</strong>');
        this.drawRoute(doc);
      } else {
        this.destMarker.setLatLng([doc.customerLat, doc.customerLng]);
      }
    }

    if (doc.driverLat != null && doc.driverLng != null) {
      const driverIcon = L.divIcon({
        html: `<div style="background:#FF9800;color:#fff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,.4);border:3px solid #fff;">🛵</div>`,
        className: '', iconSize: [34, 34], iconAnchor: [17, 17]
      });
      if (!this.driverMarker) {
        this.driverMarker = L.marker([doc.driverLat, doc.driverLng], { icon: driverIcon })
          .addTo(this.map!).bindPopup(`<strong>${doc.driverName || 'Tài xế'}</strong>`);
      } else {
        this.driverMarker.setLatLng([doc.driverLat, doc.driverLng]);
      }
    }

    const storeLat = (environment as any).storeLat ?? 16.019693;
    const storeLng = (environment as any).storeLng ?? 108.197694;
    if (doc.customerLat && doc.customerLng) {
      const bounds = L.latLngBounds([[storeLat, storeLng], [doc.customerLat, doc.customerLng]]);
      if (doc.driverLat != null && doc.driverLng != null) bounds.extend([doc.driverLat, doc.driverLng]);
      this.map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  private drawRoute(doc: DeliveryTrackingDoc): void {
    if (!this.map || !doc.customerLat || !doc.customerLng) return;
    const storeLat = (environment as any).storeLat ?? 16.019693;
    const storeLng = (environment as any).storeLng ?? 108.197694;
    const coordStr = `${storeLng},${storeLat};${doc.customerLng},${doc.customerLat}`;
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

    fetch(osrmUrl)
      .then(r => r.json())
      .then(res => {
        this.routeLine?.remove();
        if (res.routes?.[0]?.geometry?.coordinates) {
          const latlngs = res.routes[0].geometry.coordinates.map(
            (c: number[]) => [c[1], c[0]] as L.LatLngTuple
          );
          this.routeLine = L.polyline(latlngs, {
            color: '#1976D2', weight: 4, opacity: 0.7, dashArray: '8, 4'
          }).addTo(this.map!);
        } else {
          this.drawStraightLine(doc);
        }
      })
      .catch(() => this.drawStraightLine(doc));
  }

  private drawStraightLine(doc: DeliveryTrackingDoc): void {
    if (!this.map) return;
    const storeLat = (environment as any).storeLat ?? 16.019693;
    const storeLng = (environment as any).storeLng ?? 108.197694;
    this.routeLine = L.polyline(
      [[storeLat, storeLng], [doc.customerLat, doc.customerLng]],
      { color: '#1976D2', weight: 3, opacity: 0.5, dashArray: '6, 6' }
    ).addTo(this.map);
  }

  private requestMyLocation(): void {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (!this.map) return;
      const myIcon = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#1976D2;border:3px solid #fff;box-shadow:0 0 0 2px #1976D2;"></div>`,
        className: '', iconSize: [14, 14], iconAnchor: [7, 7]
      });
      if (!this.myMarker) {
        this.myMarker = L.marker([coords.latitude, coords.longitude], { icon: myIcon })
          .addTo(this.map!).bindPopup('Vị trí của bạn');
      } else {
        this.myMarker.setLatLng([coords.latitude, coords.longitude]);
      }
    }, () => {}, { enableHighAccuracy: true, timeout: 10000 });
  }
}
