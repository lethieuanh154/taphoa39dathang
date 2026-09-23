import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, NgZone, OnDestroy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';

/** Chi hien 1 lan duy nhat cho moi may. Doi key neu can hien lai cho khach cu. */
const HINT_KEY = 'sm_bubble_hint_v1';
/** Doi 2 bubble render xong roi moi do vi tri. */
const POLL_MS = 700;
const MAX_TRIES = 12;
/** Khung no ra quanh bubble cho de thay. */
const RING_PAD = 8;

/** Vi tri icon ve lai tren tung bubble. */
interface HintSpot {
  left: number;
  top: number;
  size: number;
  icon: string;
}

/** Khung vien bao ca 2 bubble (chung xep sat nhau nen bao chung 1 khung cho gon). */
interface HintFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Hint 1 lan: chi cho khach biet nut tai khoan va nut chat co the keo di cho khac.
 * Dat trong app.component (canh chat bubble) nen chay o moi trang, nhung chi hien
 * khi CA HAI bubble ton tai - tuc la sau khi khach xac nhan so dien thoai va dang o Home.
 */
@Component({
  selector: 'app-bubble-hint',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bubble-hint.component.html',
  styleUrls: ['./bubble-hint.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BubbleHintComponent implements OnInit, OnDestroy {
  visible = false;
  spots: HintSpot[] = [];
  frame: HintFrame | null = null;
  /** The huong dan phai tranh cho 2 bubble, neu khong no che mat thu can chi. */
  cardTop: number | null = null;
  cardBottom: number | null = null;

  private tries = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly onResize = () => this.remeasure();

  constructor(private zone: NgZone, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (this.alreadySeen()) return;
    this.zone.runOutsideAngular(() => this.waitForBubbles());
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
    window.removeEventListener('resize', this.onResize);
  }

  dismiss(): void {
    if (!this.visible) return;
    this.visible = false;
    window.removeEventListener('resize', this.onResize);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      // Che do rieng tu / chan storage -> chap nhan hien lai lan sau.
    }
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dismiss();
  }

  private alreadySeen(): boolean {
    try {
      return localStorage.getItem(HINT_KEY) === '1';
    } catch {
      return true; // Khong doc duoc storage -> khong hien de tranh hien lai moi lan vao.
    }
  }

  /** Thu lai vai lan vi profile bubble chi xuat hien sau khi xac nhan danh tinh. */
  private waitForBubbles(): void {
    this.timer = setTimeout(() => {
      this.timer = null;
      const spots = this.collect();
      if (spots.length < 2) {
        if (++this.tries < MAX_TRIES) this.waitForBubbles();
        return;
      }
      this.zone.run(() => {
        this.spots = spots;
        this.frame = this.union(spots);
        this.placeCard(this.frame);
        this.visible = true;
        window.addEventListener('resize', this.onResize);
        this.cdr.markForCheck();
      });
    }, POLL_MS);
  }

  /**
   * Dung querySelector vi 2 bubble nam o 2 noi khac nhau: chat bubble o app root,
   * profile bubble o trong Home (qua router-outlet) -> @ViewChild khong voi toi duoc.
   */
  private collect(): HintSpot[] {
    const out: HintSpot[] = [];
    const add = (selector: string, icon: string) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return;
      const box = el.getBoundingClientRect();
      if (box.width < 8 || box.height < 8) return;
      const size = Math.max(box.width, box.height);
      out.push({
        left: Math.round(box.left + box.width / 2 - size / 2),
        top: Math.round(box.top + box.height / 2 - size / 2),
        size: Math.round(size),
        icon
      });
    };
    add('app-profile-bubble', '👤');
    add('app-chat-bubble', '💬');
    return out;
  }

  private remeasure(): void {
    if (!this.visible) return;
    this.spots = this.collect();
    this.frame = this.union(this.spots);
    this.placeCard(this.frame);
    this.cdr.markForCheck();
  }

  /**
   * Bubble o nua duoi man hinh (mac dinh, goc phai duoi) -> dat the phia TREN khung.
   * Neu khach da keo bubble len nua tren thi dat the phia DUOI khung.
   */
  private placeCard(frame: HintFrame | null): void {
    const vh = window.innerHeight || 800;
    const gap = 14;
    if (!frame) {
      this.cardTop = null;
      this.cardBottom = null;
      return;
    }
    if (frame.top > vh * 0.45) {
      this.cardTop = null;
      this.cardBottom = Math.round(Math.min(vh - frame.top + gap, vh * 0.6));
    } else {
      this.cardBottom = null;
      this.cardTop = Math.round(frame.top + frame.height + gap);
    }
  }

  /** Hop chu nhat bao het cac bubble tim duoc. */
  private union(spots: HintSpot[]): HintFrame | null {
    if (!spots.length) return null;
    const left = Math.min(...spots.map(s => s.left));
    const top = Math.min(...spots.map(s => s.top));
    const right = Math.max(...spots.map(s => s.left + s.size));
    const bottom = Math.max(...spots.map(s => s.top + s.size));
    // No ra RING_PAD moi phia cho vien khong dinh sat bubble
    return {
      left: left - RING_PAD,
      top: top - RING_PAD,
      width: right - left + RING_PAD * 2,
      height: bottom - top + RING_PAD * 2
    };
  }
}
