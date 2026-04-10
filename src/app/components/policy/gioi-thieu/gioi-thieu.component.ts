import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PolicyFooterComponent } from '../../policy-footer/policy-footer.component';

@Component({
  selector: 'app-gioi-thieu',
  standalone: true,
  imports: [RouterModule, PolicyFooterComponent],
  templateUrl: './gioi-thieu.component.html',
  styleUrls: ['../policy-shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GioiThieuComponent {}
