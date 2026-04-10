import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PolicyFooterComponent } from '../../policy-footer/policy-footer.component';

@Component({
  selector: 'app-dieu-khoan-su-dung',
  standalone: true,
  imports: [RouterModule, PolicyFooterComponent],
  templateUrl: './dieu-khoan-su-dung.component.html',
  styleUrls: ['../policy-shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DieuKhoanSuDungComponent {}
