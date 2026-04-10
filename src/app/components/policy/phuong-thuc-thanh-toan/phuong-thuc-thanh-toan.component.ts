import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PolicyFooterComponent } from '../../policy-footer/policy-footer.component';

@Component({
  selector: 'app-phuong-thuc-thanh-toan',
  standalone: true,
  imports: [RouterModule, PolicyFooterComponent],
  templateUrl: './phuong-thuc-thanh-toan.component.html',
  styleUrls: ['../policy-shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PhuongThucThanhToanComponent {}
