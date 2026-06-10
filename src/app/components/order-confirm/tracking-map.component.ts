import {
  Component, Input, OnChanges, SimpleChanges,
  AfterViewInit, OnDestroy, ElementRef, ViewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import * as L from 'leaflet';
import { DeliveryTrackingDoc } from '../../services/delivery-tracking.service';

// Fix Leaflet default icon path
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

@Component({
  selector: 'app-tracking-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #mapEl class="tracking-map"></div>`,
  styleUrls: ['../../../../node_modules/leaflet/dist/leaflet.css'],
  styles: [`
    .tracking-map {
      width: 100%;
      height: 250px;
      border-radius: 12px;
      z-index: 1;
    }
  `]
})
export class TrackingMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapEl') mapEl!: ElementRef;
  @Input() tracking: DeliveryTrackingDoc | null = null;

  private map: L.Map | null = null;
  private storeMarker: L.Marker | null = null;
  private customerMarker: L.Marker | null = null;
  private driverMarker: L.Marker | null = null;
  private routeLine: L.Polyline | null = null;

  ngAfterViewInit(): void {
    this.initMap();
    this.updateMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.map && changes['tracking']) {
      this.updateMap();
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  private initMap(): void {
    const t = this.tracking;
    const center: L.LatLngTuple = t
      ? [(t.storeLat + t.customerLat) / 2, (t.storeLng + t.customerLng) / 2]
      : [16.019693, 108.197694];

    this.map = L.map(this.mapEl.nativeElement, {
      center,
      zoom: 14,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.map);
  }

  private updateMap(): void {
    if (!this.map || !this.tracking) return;

    // Clear old layers
    this.storeMarker?.remove();
    this.customerMarker?.remove();
    this.driverMarker?.remove();
    this.routeLine?.remove();

    const t = this.tracking;

    // Store marker
    const storeIcon = L.divIcon({
      html: `<div style="background:#E91E63;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 4px rgba(0,0,0,0.3);border:2px solid #fff;">🏪</div>`,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    this.storeMarker = L.marker([t.storeLat, t.storeLng], { icon: storeIcon }).addTo(this.map);

    // Customer marker
    const custIcon = L.divIcon({
      html: `<div style="background:#4CAF50;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 4px rgba(0,0,0,0.3);border:2px solid #fff;">📍</div>`,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    this.customerMarker = L.marker([t.customerLat, t.customerLng], { icon: custIcon }).addTo(this.map);

    // Route polyline
    if (t.routePolyline?.length > 1) {
      this.routeLine = L.polyline(
        t.routePolyline.map(p => [p[0], p[1]] as L.LatLngTuple),
        { color: '#1976D2', weight: 3, opacity: 0.7, dashArray: '6,4' }
      ).addTo(this.map);
    }

    // Driver marker
    if (t.driverLat && t.driverLng) {
      const driverIcon = L.divIcon({
        html: `<div style="background:#FF9800;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #fff;animation:pulse 1.5s infinite;">🛵</div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      this.driverMarker = L.marker([t.driverLat, t.driverLng], { icon: driverIcon }).addTo(this.map);
    }

    // Fit bounds
    const bounds = L.latLngBounds([
      [t.storeLat, t.storeLng],
      [t.customerLat, t.customerLng]
    ]);
    if (t.driverLat && t.driverLng) {
      bounds.extend([t.driverLat, t.driverLng]);
    }
    this.map.fitBounds(bounds, { padding: [30, 30] });
  }
}
