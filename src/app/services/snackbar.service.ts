import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface SnackbarMessage {
  text: string;
  type: 'success' | 'error' | 'warning';
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  private message$ = new Subject<SnackbarMessage>();

  getMessage$() {
    return this.message$.asObservable();
  }

  success(text: string, duration = 2500): void {
    this.message$.next({ text, type: 'success', duration });
  }

  error(text: string, duration = 4000): void {
    this.message$.next({ text, type: 'error', duration });
  }

  warning(text: string, duration = 3000): void {
    this.message$.next({ text, type: 'warning', duration });
  }
}
