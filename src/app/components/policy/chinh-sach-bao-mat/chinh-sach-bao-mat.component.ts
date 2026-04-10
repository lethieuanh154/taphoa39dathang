import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PolicyFooterComponent } from '../../policy-footer/policy-footer.component';

@Component({
  selector: 'app-chinh-sach-bao-mat',
  standalone: true,
  imports: [RouterModule, PolicyFooterComponent],
  templateUrl: './chinh-sach-bao-mat.component.html',
  styleUrls: ['../policy-shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChinhSachBaoMatComponent {}
