import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PolicyFooterComponent } from '../../policy-footer/policy-footer.component';

@Component({
  selector: 'app-huong-dan-mua-hang',
  standalone: true,
  imports: [RouterModule, PolicyFooterComponent],
  templateUrl: './huong-dan-mua-hang.component.html',
  styleUrls: ['../policy-shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HuongDanMuaHangComponent {}
