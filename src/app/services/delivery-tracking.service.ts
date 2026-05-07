import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, Firestore, Unsubscribe } from 'firebase/firestore';
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
  private unsub: Unsubscribe | null = null;

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

  /** Listen to tracking doc for a specific order (real-time) */
  listenToTracking(orderId: string): Observable<DeliveryTrackingDoc | null> {
    const subject = new BehaviorSubject<DeliveryTrackingDoc | null>(null);
    if (!this.db) return subject.asObservable();

    this.disconnect();
    const docRef = doc(this.db, COLLECTION, orderId);
    this.unsub = onSnapshot(docRef, snapshot => {
      if (snapshot.exists()) {
        subject.next(snapshot.data() as DeliveryTrackingDoc);
      } else {
        subject.next(null);
      }
    }, err => {
      console.error('[DeliveryTracking] Listen error:', err);
    });

    return subject.asObservable();
  }

  disconnect(): void {
    this.unsub?.();
    this.unsub = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
