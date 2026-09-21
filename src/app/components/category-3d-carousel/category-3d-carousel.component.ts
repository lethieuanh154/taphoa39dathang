import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef,
  EventEmitter, HostListener, Input, NgZone, OnChanges, OnDestroy, Output,
  QueryList, SimpleChanges, ViewChild, ViewChildren
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { getCategoryVisual } from '../../shared/category-icon';

export interface Category3D {
  id: string;
  name: string;
  /** Anh nen card. Neu thieu -> dung icon + gradient. */
  image?: string;
  slug?: string;
  /** Emoji hien khi khong co anh. Thieu -> suy ra tu ten danh muc. */
  icon?: string;
  gradient?: string;
}

/** Ket qua do kich thuoc, dung de set CSS var. */
interface Metrics {
  cardW: number;
  cardH: number;
  radius: number;
  perspective: number;
}

/**
 * Khoang ho giua 2 card ke nhau tren vong tron (1 = dinh nhau).
 * Nhieu card thi cong thuc da cho ban kinh lon san nen ho it hon la du.
 */
const RING_GAP = 1.5;
const RING_GAP_MANY = 1.25;
/** Tu so card nay tro len thi dung RING_GAP_MANY. */
const MANY_CARDS = 13;
/**
 * Khi card da bi chan boi chieu cao ma ngang con trong, cho noi ban kinh them
 * toi da 15% - nhung chi voi nhieu card. It card thi khe giua chung von da rong,
 * noi them nua se thanh roi rac.
 */
const FILL_LIMIT_MANY = 1.15;
/** perspective = PERSPECTIVE_K * radius. Nua be rong chieu len man hinh = SILHOUETTE * radius. */
const PERSPECTIVE_K = 2.6;
const SILHOUETTE = PERSPECTIVE_K / (PERSPECTIVE_K + 1);

/** Nhan danh muc: toi da 2 dong, font nho nhat 10px. */
const LABEL_MAX_LINES = 2;
const LABEL_LINE_H = 1.14;
const LABEL_MIN_SIZE = 10;

@Component({
  selector: 'app-category-3d-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-3d-carousel.component.html',
  styleUrls: ['./category-3d-carousel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Category3dCarouselComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() categories: Category3D[] = [];
  @Input() autoRotate = false;
  @Input() autoRotateInterval = 4500;
  /** Kich thuoc card o desktop; tablet/mobile tu scale xuong. */
  @Input() cardWidth = 200;
  @Input() cardHeight = 280;
  /** 0 = tu tinh ban kinh theo so luong card. */
  @Input() radius = 0;
  @Input() enableDrag = true;
  @Input() enableTouch = true;
  /** Mac dinh tat: wheel phai preventDefault nen se chan scroll trang khi tro chuot trong carousel. */
  @Input() enableWheel = false;
  @Input() enableKeyboard = true;
  @Input() disableAutoRotateOnMobile = true;
  /** Nhieu hon nguong nay thi doi dots sang thanh progress. */
  @Input() maxDots = 15;
  /**
   * Chieu cao toi da cua carousel theo ti le chieu cao khung nhin.
   * Mobile (< 640px) 0.32 ~ 1/3 man hinh; desktop/tablet 0.58 (man hinh ngang thap
   * nhu laptop 800px se tu co card lai de khong day san pham xuong qua sau).
   */
  @Input() mobileHeightRatio = 0.32;
  @Input() desktopHeightRatio = 0.58;
  /** Thoi gian khong tuong tac truoc khi auto rotate chay lai. */
  @Input() autoResumeDelay = 2500;
  @Input() ariaLabel = 'Danh mục sản phẩm';
  /**
   * Dong bo tu ben ngoai: id cua danh muc dang chon (VD user chon o cho khac).
   * Doi -> vong tu xoay den card do, KHONG emit categorySelected.
   * null/undefined (VD dang xem "Tat ca") -> giu nguyen vi tri.
   */
  @Input() activeId?: string | null;

  @Output() categorySelected = new EventEmitter<Category3D>();

  @ViewChild('stage') private stageRef?: ElementRef<HTMLElement>;
  @ViewChild('ring') private ringRef?: ElementRef<HTMLElement>;
  @ViewChildren('cardEl') private cardRefs?: QueryList<ElementRef<HTMLElement>>;

  activeIndex = 0;

  /** Goc xoay cua ring (deg, khong gioi han bien do -> giu duoc chieu xoay). */
  private ringAngle = 0;
  private metrics: Metrics = { cardW: 200, cardH: 280, radius: 300, perspective: 1200 };

  private dragging = false;
  private dragPointerId: number | null = null;
  private dragStartX = 0;
  private dragStartAngle = 0;
  private dragDistance = 0;
  private lastX = 0;
  private lastMoveTime = 0;
  private velocity = 0;
  private pendingAngle: number | null = null;
  private rafId = 0;

  private hovering = false;
  private autoTimer: ReturnType<typeof setInterval> | null = null;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  private wheelLockUntil = 0;

  private removers: Array<() => void> = [];
  private dragRemovers: Array<() => void> = [];
  private resizeObserver?: ResizeObserver;
  private visibilityObserver?: IntersectionObserver;
  /** Carousel da cuon ra ngoai khung nhin -> khong auto rotate cho ton pin. */
  private offScreen = false;
  private cardsSub?: Subscription;
  private viewReady = false;
  private firstLayoutDone = false;
  private measureCtx?: CanvasRenderingContext2D | null;
  private labelFontFamily = 'inherit';
  private animEnabled = true;
  private smoothAnim = false;

  private static readonly WHEEL_THROTTLE_MS = 380;
  private static readonly DRAG_CLICK_THRESHOLD = 8;
  private static readonly FLICK_VELOCITY = 0.5;

  constructor(
    private host: ElementRef<HTMLElement>,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  // ======================== Lifecycle ========================

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.bindPointerEvents();
    this.bindWheel();
    this.observeResize();
    this.observeVisibility();
    this.cardsSub = this.cardRefs?.changes.subscribe(() => this.relayout());
    this.relayout();
    this.syncActiveId();
    this.startAuto();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categories']) {
      this.activeIndex = this.count ? Math.min(this.activeIndex, this.count - 1) : 0;
      this.ringAngle = -this.activeIndex * this.step;
    }
    if (!this.viewReady) return;
    if (changes['activeId'] || changes['categories']) this.syncActiveId();
    if (changes['autoRotate'] || changes['autoRotateInterval'] || changes['disableAutoRotateOnMobile']) {
      this.stopAuto();
      this.startAuto();
    }
    // Khi so luong card doi, QueryList.changes se goi relayout.
    if (changes['cardWidth'] || changes['cardHeight'] || changes['radius']) this.relayout();
  }

  ngOnDestroy(): void {
    this.stopAuto();
    this.clearResumeTimer();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    this.cardsSub?.unsubscribe();
    this.detachDragListeners();
    this.removers.forEach(fn => fn());
    this.removers = [];
  }

  // ======================== Template helpers ========================

  get count(): number {
    return this.categories?.length ?? 0;
  }

  /** Goc giua 2 card ke nhau tren vong tron. */
  get step(): number {
    return this.count > 0 ? 360 / this.count : 0;
  }

  get showDots(): boolean {
    return this.count > 1 && this.count <= this.maxDots;
  }

  get showProgress(): boolean {
    return this.count > this.maxDots;
  }

  get progressPercent(): number {
    return this.count > 1 ? ((this.activeIndex + 1) / this.count) * 100 : 100;
  }

  get activeCategory(): Category3D | null {
    return this.categories?.[this.activeIndex] ?? null;
  }

  trackById(index: number, cat: Category3D): string {
    return cat?.id ?? String(index);
  }

  cardBackground(cat: Category3D, index: number): string {
    return cat.gradient || getCategoryVisual(cat.name, index).gradient;
  }

  cardIcon(cat: Category3D, index: number): string {
    return cat.icon || getCategoryVisual(cat.name, index).icon;
  }

  // ======================== Navigation ========================

  goPrev(): void {
    this.userInteracted();
    this.rotateToIndex(this.activeIndex - 1);
  }

  goNext(): void {
    this.userInteracted();
    this.rotateToIndex(this.activeIndex + 1);
  }

  onDotClick(index: number): void {
    this.userInteracted();
    this.selectIndex(index);
  }

  onCardClick(index: number): void {
    // Click sinh ra sau khi keo qua nguong -> coi la drag, khong phai chon.
    if (this.dragDistance > Category3dCarouselComponent.DRAG_CLICK_THRESHOLD) return;
    this.userInteracted();
    this.selectIndex(index);
  }

  /**
   * Tab tay den card nao thi xoay card do ra truoc, nhung khong emit.
   * Bo qua khi dang drag: pointerdown cung sinh ra focus, neu khong chan
   * thi thao tac keo se bi mot lenh xoay chen ngang.
   */
  onCardFocus(index: number): void {
    if (this.dragging || index === this.activeIndex) return;
    this.userInteracted();
    this.rotateToIndex(index);
  }

  onKeydown(ev: KeyboardEvent): void {
    if (!this.enableKeyboard || this.count < 1) return;
    // Card la div role="button" nen phai tu xu ly Enter/Space.
    // Chi card active co tabindex 0 -> phim luon ung voi card dang o phia truoc.
    if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
      const cat = this.activeCategory;
      if (!cat) return;
      ev.preventDefault();
      this.userInteracted();
      this.categorySelected.emit(cat);
      return;
    }
    if (this.count < 2) return;
    switch (ev.key) {
      case 'ArrowLeft': this.goPrev(); break;
      case 'ArrowRight': this.goNext(); break;
      case 'Home': this.rotateToIndex(0); break;
      case 'End': this.rotateToIndex(this.count - 1); break;
      default: return;
    }
    ev.preventDefault();
    // Sau khi xoay, focus phai theo sang card active moi.
    this.focusActiveCard();
  }

  private selectIndex(index: number): void {
    this.rotateToIndex(index);
    const cat = this.categories?.[this.activeIndex];
    if (cat) this.categorySelected.emit(cat);
  }

  /**
   * So buoc xoay ngan nhat (co dau) tu currentIndex sang targetIndex.
   * VD 8 item, 0 -> 7 tra ve -1 (xoay nguoc 1 buoc) thay vi +7.
   */
  getShortestRotation(currentIndex: number, targetIndex: number, totalItems: number): number {
    if (totalItems <= 0) return 0;
    let delta = (targetIndex - currentIndex) % totalItems;
    if (delta > totalItems / 2) delta -= totalItems;
    if (delta < -totalItems / 2) delta += totalItems;
    return delta;
  }

  /** smooth = true: dung transition dai & diu hon (danh cho auto rotate). */
  private rotateToIndex(target: number, smooth = false): void {
    const n = this.count;
    if (n < 1) return;
    this.setSmooth(smooth);
    const step = this.step;
    const norm = ((target % n) + n) % n;
    // Index dang o phia truoc theo goc hien tai (ringAngle la so thuc khi vua drag xong).
    const currentTurn = Math.round(-this.ringAngle / step);
    const currentIndex = ((currentTurn % n) + n) % n;
    const delta = this.getShortestRotation(currentIndex, norm, n);
    // Xuat phat tu goc da snap cua vong quay hien tai -> khong bao gio xoay qua nua vong.
    this.ringAngle = -currentTurn * step - delta * step;
    this.activeIndex = norm;
    this.paint(true);
    this.cdr.markForCheck();
  }

  /** Xoay den danh muc ma ben ngoai dang chon (neu khac card hien tai). */
  private syncActiveId(): void {
    if (this.activeId == null) return;
    const index = this.categories.findIndex(c => c.id === this.activeId);
    if (index < 0 || index === this.activeIndex) return;
    this.rotateToIndex(index, true);
  }

  private focusActiveCard(): void {
    const el = this.cardRefs?.toArray()[this.activeIndex]?.nativeElement;
    el?.focus({ preventScroll: true });
  }

  // ======================== 3D layout + paint ========================

  private relayout(): void {
    if (!this.viewReady) return;
    this.measure();
    this.applyCardAngles();
    this.fitLabels();
    if (!this.firstLayoutDone) {
      // Lan dau: dat dung vi tri ma khong animation, frame sau moi bat transition.
      this.firstLayoutDone = true;
      this.paint(false);
      this.zone.runOutsideAngular(() => requestAnimationFrame(() => this.paint(true)));
      return;
    }
    this.paint(true);
  }

  /** Tinh kich thuoc card, ban kinh vong tron va perspective theo be rong thuc te. */
  private measure(): void {
    const stage = this.stageRef?.nativeElement;
    if (!stage) return;
    const stageW = stage.clientWidth || this.host.nativeElement.clientWidth || 360;
    const scale = stageW < 420 ? 0.6 : stageW < 640 ? 0.72 : stageW < 1024 ? 0.85 : 1;
    let cardW = this.clamp(Math.round(this.cardWidth * scale), 104, 260);
    let cardH = this.clamp(Math.round(this.cardHeight * scale), 144, 340);
    // Noi card cho vong trai het be rong khung. Lam to CARD (vong to theo) chu khong
    // giang rieng ban kinh, neu khong card nho ma khe giua cac card ho hoac.
    const fillW = this.fillCardWidth(stageW);
    if (fillW > cardW) {
      cardW = Math.round(this.clamp(fillW, cardW, 260));
      cardH = Math.round(cardW * (this.cardHeight / this.cardWidth));
    }

    let radius = this.computeRadius(cardW, stageW);
    let stageH = cardH * 1.42 + this.tiltRoom(cardH, radius);

    // Co lai theo chieu cao khung nhin de carousel khong an het man hinh.
    const budget = this.heightBudget(stageW);
    if (stageH > budget) {
      const k = budget / stageH;
      cardW = Math.max(Math.round(cardW * k), 86);
      cardH = Math.max(Math.round(cardH * k), 118);
      radius = this.computeRadius(cardW, stageW);
      stageH = cardH * 1.42 + this.tiltRoom(cardH, radius);
    }

    // Perspective tang theo ban kinh, neu khong card phia sau bi bien dang qua manh.
    // He so cang lon -> silhouette vong cang rong (trai duoc het khung) va phoi canh diu hon.
    const perspective = Math.round(Math.max(900, radius * PERSPECTIVE_K));
    // Be rong nua vong tron sau khi chieu phoi canh: dung de dat 2 nut nav sat vien vong.
    const edge = Math.round(radius * perspective / (perspective + radius) + cardW * 0.4);

    if (this.labelFontFamily === 'inherit' && typeof getComputedStyle === 'function') {
      this.labelFontFamily = getComputedStyle(this.host.nativeElement).fontFamily || 'sans-serif';
    }

    this.metrics = { cardW, cardH, radius, perspective };
    const style = this.host.nativeElement.style;
    style.setProperty('--cw', cardW + 'px');
    style.setProperty('--ch', cardH + 'px');
    style.setProperty('--radius', String(radius));
    style.setProperty('--perspective', perspective + 'px');
    style.setProperty('--edge', edge + 'px');
    style.setProperty('--stage-h', Math.round(stageH) + 'px');
  }

  /**
   * Ban kinh vong tron: du de 2 card ke nhau khong dam vao nhau -> (w/2) / tan(pi/n),
   * nhung co san toi thieu (it card) va chan tren (nhieu card, tranh vong qua rong).
   */
  private computeRadius(cardW: number, stageW: number): number {
    const n = Math.max(this.count, 1);
    const gap = n < MANY_CARDS ? RING_GAP : RING_GAP_MANY;
    const fitted = n < 2 ? cardW : (cardW / 2) / Math.tan(Math.PI / n) * gap;
    // San: du de card khong dam vao nhau.
    // Rat it card: cong thuc `fitted` cho ban kinh qua nho (card cach nhau 120 do
    // nhung card phia sau van chieu lot ra hai ben) -> ep san theo be rong card.
    const floor = Math.max(fitted, cardW * 1.7);
    if (this.radius > 0) return Math.round(this.clamp(this.radius, cardW * 0.9, cardW * 6));
    // Noi rong cho vong trai het be rong khung, nhung khong qua FILL_LIMIT lan san
    // (it card ma keo het be rong thi khe giua cac card ho hoac, trong rat trong).
    const limit = n >= MANY_CARDS ? FILL_LIMIT_MANY : 1;
    const wanted = this.clamp(this.fillWidthRadius(cardW, stageW), floor, floor * limit);
    // KHONG chan theo be rong stage: voi 18-20 danh muc vong tron rong hon stage la dung,
    // phan hai ben bi `overflow: hidden` cat bot, doi lai card khong chong nhau.
    return Math.round(this.clamp(wanted, cardW * 0.9, cardW * 6));
  }

  /**
   * Be rong card lon nhat ma silhouette cua vong (o ban kinh khong chong nhau)
   * van vua khung: R = kR * cardW, nua be rong chieu = SILHOUETTE * R + 0.4 * cardW.
   */
  private fillCardWidth(stageW: number): number {
    const n = Math.max(this.count, 1);
    const gap = n < MANY_CARDS ? RING_GAP : RING_GAP_MANY;
    const kR = n < 2 ? 1.7 : Math.max((1 / (2 * Math.tan(Math.PI / n))) * gap, 1.7);
    return stageW / (2 * (SILHOUETTE * kR + 0.4));
  }

  /**
   * Ban kinh de silhouette cua vong vua bang be rong khung.
   * Nua be rong sau khi chieu phoi canh = R * P/(P+R) = SILHOUETTE * R;
   * cong them mep card o hai bien (~0.4 * cardW) roi cho bang stageW / 2.
   */
  private fillWidthRadius(cardW: number, stageW: number): number {
    return (stageW / 2 - cardW * 0.4) / SILHOUETTE;
  }

  /** Cho trong bu cho cung phia sau nhoi len do --tilt (khong de vong to keo stage cao vo han). */
  private tiltRoom(cardH: number, radius: number): number {
    return Math.min(radius * 0.12, cardH * 0.34);
  }

  /** Chieu cao toi da cua stage, tinh theo chieu cao khung nhin. */
  private heightBudget(stageW: number): number {
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
    const ratio = stageW < 640 ? this.mobileHeightRatio : this.desktopHeightRatio;
    // Tru ~46px cho hang dots/progress nam duoi carousel.
    return Math.max(vh * ratio - 46, 150);
  }

  /**
   * Ten danh muc luon hien DU: cho xuong toi da 2 dong, neu van khong vua thi
   * thu nho font. Do be rong chu bang canvas (khong doc layout) roi chi doc
   * lai scrollHeight mot lan de bat truong hop hiem con tran.
   */
  private fitLabels(): void {
    const cards = this.cardRefs?.toArray() ?? [];
    if (!cards.length) return;
    const maxW = Math.max(this.metrics.cardW - 16, 40);
    const base = this.clamp(Math.round(this.metrics.cardW * 0.115), 12, 18);

    const els: HTMLElement[] = [];
    for (const ref of cards) {
      const el = ref.nativeElement.querySelector<HTMLElement>('.card-label-text');
      if (!el) continue;
      els.push(el);
      el.style.fontSize = this.fitFontSize(el.textContent || '', base, maxW) + 'px';
    }

    // Chot lai: neu chu van cao hon 2 dong thi co nho them theo ti le.
    const maxH = Math.round(base * LABEL_LINE_H * LABEL_MAX_LINES) + 2;
    const ratios = els.map(el => (el.scrollHeight > maxH ? maxH / el.scrollHeight : 1));
    els.forEach((el, i) => {
      if (ratios[i] >= 1) return;
      const cur = parseFloat(el.style.fontSize) || base;
      el.style.fontSize = Math.max(LABEL_MIN_SIZE, Math.floor(cur * ratios[i])) + 'px';
    });
  }

  /**
   * Co chu lon nhat (<= base) ma van du cho:
   * - tu dai nhat phai vua 1 dong
   * - ca ten phai vua LABEL_MAX_LINES dong (tru 8% vi ngat dong khong bao gio deu tuyet doi)
   */
  private fitFontSize(text: string, base: number, maxW: number): number {
    const ctx = this.getMeasureCtx();
    const name = text.trim();
    if (!ctx || !name) return base;
    // Can nang 800 la truong hop rong nhat (card active).
    ctx.font = `800 ${base}px ${this.labelFontFamily}`;
    const total = ctx.measureText(name).width;
    if (!total) return base;
    const longestWord = name.split(/\s+/)
      .reduce((max, w) => Math.max(max, ctx.measureText(w).width), 1);
    const byWord = base * maxW / longestWord;
    const byTotal = base * (maxW * LABEL_MAX_LINES * 0.92) / total;
    return Math.max(LABEL_MIN_SIZE, Math.min(base, Math.floor(Math.min(byWord, byTotal))));
  }

  private getMeasureCtx(): CanvasRenderingContext2D | null {
    if (this.measureCtx !== undefined) return this.measureCtx;
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    this.measureCtx = canvas ? canvas.getContext('2d') : null;
    return this.measureCtx;
  }

  /** Goc co dinh cua tung card tren vong tron: i * step. */
  private applyCardAngles(): void {
    const step = this.step;
    this.cardRefs?.forEach((ref, i) => {
      ref.nativeElement.style.setProperty('--a', String(i * step));
    });
  }

  /** Doi bo transition: auto rotate thi cham & diu, user thao tac thi nhanh & dut khoat. */
  private setSmooth(on: boolean): void {
    if (on === this.smoothAnim) return;
    this.smoothAnim = on;
    this.stageRef?.nativeElement.classList.toggle('auto-anim', on);
  }

  /**
   * Ve lai carousel theo this.ringAngle.
   * Chi ghi CSS var (--ring, --d); transform/opacity/filter do CSS tinh bang calc()
   * -> moi frame chi ton n phep setProperty va khong chay change detection.
   */
  private paint(animate: boolean): void {
    const ring = this.ringRef?.nativeElement;
    const stage = this.stageRef?.nativeElement;
    if (!ring || !stage) return;

    if (animate !== this.animEnabled) {
      this.animEnabled = animate;
      stage.classList.toggle('no-anim', !animate);
    }

    ring.style.setProperty('--ring', String(this.ringAngle));

    const step = this.step;
    const cards = this.cardRefs?.toArray() ?? [];
    for (let i = 0; i < cards.length; i++) {
      // Goc cua card i so voi truc camera: 0 = dang o chinh giua phia truoc.
      const theta = this.normalizeAngle(this.ringAngle + i * step);
      // depth: 0 = sat camera, 1 = phia sau vong tron. CSS dung no de scale/mo/blur.
      const depth = Math.abs(theta) / 180;
      cards[i].nativeElement.style.setProperty('--d', depth.toFixed(4));
    }
  }

  /** Dua goc ve khoang (-180, 180]. */
  private normalizeAngle(deg: number): number {
    let a = deg % 360;
    if (a > 180) a -= 360;
    if (a <= -180) a += 360;
    return a;
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.min(Math.max(v, min), max);
  }

  // ======================== Resize ========================

  private observeResize(): void {
    const stage = this.stageRef?.nativeElement;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => this.relayout());
      this.resizeObserver.observe(stage);
    });
  }

  /** Ngoai khung nhin thi dung auto rotate, cuon lai thi chay tiep. */
  private observeVisibility(): void {
    const stage = this.stageRef?.nativeElement;
    if (!stage || typeof IntersectionObserver === 'undefined') return;
    this.zone.runOutsideAngular(() => {
      this.visibilityObserver = new IntersectionObserver(entries => {
        const off = !entries.some(e => e.isIntersecting);
        if (off === this.offScreen) return;
        this.offScreen = off;
        if (off) this.pauseAuto();
        else this.zone.run(() => this.startAuto());
      }, { threshold: 0.2 });
      this.visibilityObserver.observe(stage);
    });
  }

  // ======================== Drag / touch ========================

  private bindPointerEvents(): void {
    const stage = this.stageRef?.nativeElement;
    if (!stage) return;
    // Ngoai zone: pointermove khong duoc phep trigger change detection.
    this.zone.runOutsideAngular(() => {
      this.listen(stage, 'pointerdown', e => this.onPointerDown(e as PointerEvent));
      this.listen(stage, 'dragstart', e => e.preventDefault());
    });
  }

  /**
   * Nghe move/up tren window trong luc keo (thay vi setPointerCapture):
   * pointer capture keo luon ca event click ve the bat capture,
   * nhu vay (click) tren card se khong con ban.
   */
  private attachDragListeners(): void {
    this.detachDragListeners();
    this.zone.runOutsideAngular(() => {
      const move = (e: Event) => this.onPointerMove(e as PointerEvent);
      const up = (e: Event) => this.onPointerUp(e as PointerEvent);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      this.dragRemovers = [
        () => window.removeEventListener('pointermove', move),
        () => window.removeEventListener('pointerup', up),
        () => window.removeEventListener('pointercancel', up)
      ];
    });
  }

  private detachDragListeners(): void {
    this.dragRemovers.forEach(fn => fn());
    this.dragRemovers = [];
  }

  /**
   * Mot code path cho ca chuot va touch: phan biet bang pointerType
   * de van ton trong 2 co enableDrag / enableTouch.
   */
  private onPointerDown(ev: PointerEvent): void {
    if (this.count < 2) return;
    const isTouch = ev.pointerType !== 'mouse';
    if (isTouch ? !this.enableTouch : !this.enableDrag) return;
    if (!isTouch && ev.button !== 0) return;

    this.dragging = true;
    this.dragPointerId = ev.pointerId;
    this.dragStartX = ev.clientX;
    this.dragStartAngle = this.ringAngle;
    this.dragDistance = 0;
    this.lastX = ev.clientX;
    this.lastMoveTime = performance.now();
    this.velocity = 0;
    this.stageRef?.nativeElement.classList.add('grabbing');
    this.paint(false);
    this.pauseAuto();
    this.attachDragListeners();
  }

  private onPointerMove(ev: PointerEvent): void {
    if (!this.dragging || ev.pointerId !== this.dragPointerId) return;
    const dx = ev.clientX - this.dragStartX;
    this.dragDistance = Math.max(this.dragDistance, Math.abs(dx));

    const now = performance.now();
    const dt = now - this.lastMoveTime;
    if (dt > 0) this.velocity = (ev.clientX - this.lastX) / dt; // px/ms
    this.lastX = ev.clientX;
    this.lastMoveTime = now;

    // Keo ngang bang be rong 1 card ~ xoay dung 1 buoc.
    this.pendingAngle = this.dragStartAngle + dx * (this.step / (this.metrics.cardW * 0.9));
    this.scheduleFrame();
  }

  private scheduleFrame(): void {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      if (this.pendingAngle === null) return;
      this.ringAngle = this.pendingAngle;
      this.pendingAngle = null;
      this.paint(false);
    });
  }

  private onPointerUp(ev: PointerEvent): void {
    if (!this.dragging || ev.pointerId !== this.dragPointerId) return;
    this.dragging = false;
    this.dragPointerId = null;
    this.detachDragListeners();
    this.stageRef?.nativeElement.classList.remove('grabbing');
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0; }
    if (this.pendingAngle !== null) { this.ringAngle = this.pendingAngle; this.pendingAngle = null; }

    // Snap ve card gan nhat; keo nhanh (flick) thi di them 1 buoc theo huong keo.
    // velocity > 0 = keo sang phai = index giam dan.
    const flick = Math.abs(this.velocity) > Category3dCarouselComponent.FLICK_VELOCITY
      ? Math.sign(this.velocity) : 0;
    const target = Math.round(-this.ringAngle / this.step) - flick;
    this.zone.run(() => {
      this.rotateToIndex(target);
      this.scheduleResume();
    });
  }

  // ======================== Wheel ========================

  private bindWheel(): void {
    const stage = this.stageRef?.nativeElement;
    if (!stage) return;
    this.zone.runOutsideAngular(() => {
      // passive: false vi can preventDefault de trang khong scroll theo.
      const handler = (e: Event) => this.onWheel(e as WheelEvent);
      stage.addEventListener('wheel', handler, { passive: false });
      this.removers.push(() => stage.removeEventListener('wheel', handler));
    });
  }

  private onWheel(ev: WheelEvent): void {
    if (!this.enableWheel || this.count < 2) return;
    const now = performance.now();
    if (now < this.wheelLockUntil) { ev.preventDefault(); return; }
    this.wheelLockUntil = now + Category3dCarouselComponent.WHEEL_THROTTLE_MS;
    ev.preventDefault();
    const raw = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
    const dir = raw > 0 ? 1 : -1;
    this.zone.run(() => {
      this.userInteracted();
      this.rotateToIndex(this.activeIndex + dir);
    });
  }

  // ======================== Auto rotate ========================

  @HostListener('mouseenter')
  onMouseEnter(): void {
    this.hovering = true;
    this.pauseAuto();
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.hovering = false;
    this.scheduleResume();
  }

  private get autoAllowed(): boolean {
    if (!this.autoRotate || this.count < 2 || this.offScreen) return false;
    if (this.disableAutoRotateOnMobile && this.isCoarsePointer) return false;
    return true;
  }

  private get isCoarsePointer(): boolean {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  }

  private startAuto(): void {
    if (this.autoTimer || !this.autoAllowed || this.hovering || this.dragging) return;
    const interval = Math.max(800, this.autoRotateInterval);
    this.zone.runOutsideAngular(() => {
      this.autoTimer = setInterval(() => {
        this.zone.run(() => this.rotateToIndex(this.activeIndex + 1, true));
      }, interval);
    });
  }

  private stopAuto(): void {
    if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; }
  }

  private pauseAuto(): void {
    this.stopAuto();
    this.clearResumeTimer();
  }

  private clearResumeTimer(): void {
    if (this.resumeTimer) { clearTimeout(this.resumeTimer); this.resumeTimer = null; }
  }

  /** Het autoResumeDelay khong tuong tac -> chay lai auto rotate. */
  private scheduleResume(): void {
    this.clearResumeTimer();
    if (!this.autoAllowed || this.hovering) return;
    this.zone.runOutsideAngular(() => {
      this.resumeTimer = setTimeout(() => {
        this.resumeTimer = null;
        this.startAuto();
      }, Math.max(500, this.autoResumeDelay));
    });
  }

  private userInteracted(): void {
    this.pauseAuto();
    this.scheduleResume();
  }

  // ======================== Utils ========================

  private listen(el: HTMLElement, type: string, fn: (ev: Event) => void): void {
    el.addEventListener(type, fn);
    this.removers.push(() => el.removeEventListener(type, fn));
  }
}
