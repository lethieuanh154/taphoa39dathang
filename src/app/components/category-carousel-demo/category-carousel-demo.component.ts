import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Category3dCarouselComponent, Category3D } from '../category-3d-carousel/category-3d-carousel.component';
import { getCategoryVisual } from '../../shared/category-icon';

const DEMO_NAMES = [
  'Bia', 'Nước ngọt', 'Nước suối', 'Sữa', 'Bánh kẹo',
  'Mì', 'Đồ hộp', 'Gia vị', 'Đồ ăn nhanh', 'Hóa mỹ phẩm'
];

/** Slug khong dau tu ten danh muc. */
function toSlug(name: string): string {
  return name.normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Anh placeholder dang data-URI (khong can file trong assets). */
function placeholderImage(name: string, index: number): string {
  const visual = getCategoryVisual(name, index);
  const stops = visual.gradient.match(/#[0-9a-f]{6}/gi) ?? ['#81c784', '#2e7d32'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="${stops[0]}"/><stop offset="1" stop-color="${stops[1] ?? stops[0]}"/>`
    + `</linearGradient></defs>`
    + `<rect width="400" height="560" fill="url(#g)"/>`
    + `<text x="200" y="300" font-size="150" text-anchor="middle">${visual.icon}</text>`
    + `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

@Component({
  selector: 'app-category-carousel-demo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Category3dCarouselComponent],
  templateUrl: './category-carousel-demo.component.html',
  styleUrls: ['./category-carousel-demo.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoryCarouselDemoComponent {
  autoRotate = true;
  autoRotateInterval = 4500;
  enableDrag = true;
  enableTouch = true;
  enableWheel = true;
  enableKeyboard = true;
  useImages = false;

  /** Doi so luong de kiem tra component khong hard-code so category. */
  countOptions = [3, 5, 8, 10, 15, 18, 20];
  visibleCount = 18;   // dung nhu so danh muc thuc te

  selected: Category3D | null = null;
  log: string[] = [];

  categories: Category3D[] = this.build();

  onVisibleCountChange(): void {
    this.categories = this.build();
  }

  onUseImagesChange(): void {
    this.categories = this.build();
  }

  onCategorySelected(cat: Category3D): void {
    this.selected = cat;
    this.log = [`${new Date().toLocaleTimeString('vi-VN')} — chọn "${cat.name}" (slug: ${cat.slug})`,
      ...this.log].slice(0, 5);
  }

  /** Lap lai danh sach mau cho du visibleCount de test 15/20 item. */
  private build(): Category3D[] {
    const out: Category3D[] = [];
    for (let i = 0; i < this.visibleCount; i++) {
      const name = DEMO_NAMES[i % DEMO_NAMES.length];
      const round = Math.floor(i / DEMO_NAMES.length);
      const label = round > 0 ? `${name} ${round + 1}` : name;
      out.push({
        id: `${toSlug(label)}-${i}`,
        name: label,
        slug: toSlug(label),
        image: this.useImages ? placeholderImage(name, i) : undefined
      });
    }
    return out;
  }
}
