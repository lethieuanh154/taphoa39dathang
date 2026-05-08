import { Injectable, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, Firestore } from 'firebase/firestore';
import { environment } from '../../environments/environment';

export interface DeliveryTrackingDoc {
  routeId: string;
  orderId: string;
  status: 'pending' | 'picking' | 'picked' | 'in_transit' | 'arrived' | 'delivered' | 'failed';
  driverName: string;
  driverLat?: number;
  driverLng?: number;
  estimatedArrival: string;
  sequence: number;
  totalOrders: number;
  routePolyline: [number, number][];
  storeLat: number;
  storeLng: number;
  customerLat: number;
  customerLng: number;
  updatedAt: string;
}

const COLLECTION = 'deliveryTracking';

@Injectable({ providedIn: 'root' })
export class DeliveryTrackingService implements OnDestroy {
  private firebaseApp: FirebaseApp | null = null;
  private db: Firestore | null = null;

  constructor() {
    this.initFirestore();
  }

  private initFirestore(): void {
    try {
      const config = (environment as any).firebaseChat;
      if (!config?.projectId) return;

      const appName = 'delivery-tracking-customer';
      const existing = getApps().find(app => app.name === appName);
      this.firebaseApp = existing || initializeApp(config, appName);
      this.db = getFirestore(this.firebaseApp);
    } catch (e) {
      console.error('[DeliveryTracking] Init error:', e);
    }
  }

  /** Listen to tracking doc — each subscriber gets its own Firestore listener */
  listenToTracking(orderId: string): Observable<DeliveryTrackingDoc | null> {
    return new Observable(subscriber => {
      if (!this.db) {
        subscriber.next(null);
        return;
      }
      const docRef = doc(this.db, COLLECTION, orderId);
      const unsub = onSnapshot(
        docRef,
        snapshot => subscriber.next(snapshot.exists() ? (snapshot.data() as DeliveryTrackingDoc) : null),
        err => {
          console.error('[DeliveryTracking] Listen error:', err);
          subscriber.error(err);
        }
      );
      return () => unsub();
    });
  }

  /** @deprecated Use RxJS unsubscribe instead */
  disconnect(): void {}

  ngOnDestroy(): void {}
}
