import { Directive, ElementRef, OnInit, OnDestroy, NgZone, Input } from '@angular/core';

/**
 * Directive cho phep keo tha (press-hold-move) cac floating bubble.
 * Su dung: <div appDraggableBubble [storageKey]="'bubble-pos'">
 * - Touch: press-hold 200ms roi keo
 * - Mouse: mousedown-hold 200ms roi keo
 * - Luu vi tri vao localStorage
 */
@Directive({
  selector: '[appDraggableBubble]',
  standalone: true
})
export class DraggableBubbleDirective implements OnInit, OnDestroy {
  @Input() storageKey = '';

  private isDragging = false;
  private holdTimer: any = null;
  private startX = 0;
  private startY = 0;
  private origLeft = 0;
  private origBottom = 0;
  private readonly HOLD_DELAY = 200;
  private readonly MOVE_THRESHOLD = 5;
  private hasMoved = false;

  private boundTouchStart = this.onTouchStart.bind(this);
  private boundTouchMove = this.onTouchMove.bind(this);
  private boundTouchEnd = this.onTouchEnd.bind(this);
  private boundMouseDown = this.onMouseDown.bind(this);
  private boundMouseMove = this.onMouseMove.bind(this);
  private boundMouseUp = this.onMouseUp.bind(this);

  constructor(private el: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngOnInit(): void {
    this.restorePosition();

    this.zone.runOutsideAngular(() => {
      const el = this.el.nativeElement;
      el.addEventListener('touchstart', this.boundTouchStart, { passive: false });
      el.addEventListener('mousedown', this.boundMouseDown);
    });
  }

  ngOnDestroy(): void {
    const el = this.el.nativeElement;
    el.removeEventListener('touchstart', this.boundTouchStart);
    el.removeEventListener('mousedown', this.boundMouseDown);
    document.removeEventListener('touchmove', this.boundTouchMove);
    document.removeEventListener('touchend', this.boundTouchEnd);
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
    clearTimeout(this.holdTimer);
  }

  // ---- Touch ----
  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    this.startHold(touch.clientX, touch.clientY);

    document.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    document.addEventListener('touchend', this.boundTouchEnd);
  }

  private onTouchMove(e: TouchEvent): void {
    const touch = e.touches[0];
    if (!this.isDragging) {
      const dx = Math.abs(touch.clientX - this.startX);
      const dy = Math.abs(touch.clientY - this.startY);
      if (dx > this.MOVE_THRESHOLD || dy > this.MOVE_THRESHOLD) {
        // Moved before hold completed — cancel
        clearTimeout(this.holdTimer);
      }
      return;
    }
    e.preventDefault();
    this.moveTo(touch.clientX, touch.clientY);
  }

  private onTouchEnd(): void {
    this.endDrag();
    document.removeEventListener('touchmove', this.boundTouchMove);
    document.removeEventListener('touchend', this.boundTouchEnd);
  }

  // ---- Mouse ----
  private onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    this.startHold(e.clientX, e.clientY);

    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) {
      const dx = Math.abs(e.clientX - this.startX);
      const dy = Math.abs(e.clientY - this.startY);
      if (dx > this.MOVE_THRESHOLD || dy > this.MOVE_THRESHOLD) {
        clearTimeout(this.holdTimer);
      }
      return;
    }
    e.preventDefault();
    this.moveTo(e.clientX, e.clientY);
  }

  private onMouseUp(): void {
    this.endDrag();
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
  }

  // ---- Shared logic ----
  private startHold(clientX: number, clientY: number): void {
    this.startX = clientX;
    this.startY = clientY;
    this.hasMoved = false;

    const el = this.el.nativeElement;
    const rect = el.getBoundingClientRect();
    this.origLeft = rect.left;
    this.origBottom = window.innerHeight - rect.bottom;

    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => {
      this.isDragging = true;
      el.style.transition = 'none';
      el.style.opacity = '0.8';
    }, this.HOLD_DELAY);
  }

  private moveTo(clientX: number, clientY: number): void {
    this.hasMoved = true;
    const el = this.el.nativeElement;

    const dx = clientX - this.startX;
    const dy = clientY - this.startY;

    let newLeft = this.origLeft + dx;
    let newBottom = this.origBottom - dy;

    // Clamp within viewport
    const maxLeft = window.innerWidth - el.offsetWidth;
    const maxBottom = window.innerHeight - el.offsetHeight;
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newBottom = Math.max(0, Math.min(newBottom, maxBottom));

    el.style.left = newLeft + 'px';
    el.style.bottom = newBottom + 'px';
    el.style.right = 'auto';
    el.style.top = 'auto';
  }

  private endDrag(): void {
    clearTimeout(this.holdTimer);

    if (this.isDragging && this.hasMoved) {
      const el = this.el.nativeElement;
      el.style.transition = '';
      el.style.opacity = '';
      this.savePosition();

      // Prevent click event after drag
      const preventClick = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      el.addEventListener('click', preventClick, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', preventClick, true), 100);
    }

    this.isDragging = false;
    this.hasMoved = false;
  }

  private savePosition(): void {
    if (!this.storageKey) return;
    const el = this.el.nativeElement;
    const pos = { left: el.style.left, bottom: el.style.bottom };
    localStorage.setItem(this.storageKey, JSON.stringify(pos));
  }

  private restorePosition(): void {
    if (!this.storageKey) return;
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (!saved) return;
      const pos = JSON.parse(saved);
      const el = this.el.nativeElement;
      if (pos.left) el.style.left = pos.left;
      if (pos.bottom) el.style.bottom = pos.bottom;
      el.style.right = 'auto';
      el.style.top = 'auto';
    } catch { /* ignore */ }
  }
}
