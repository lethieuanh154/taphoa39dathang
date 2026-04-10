import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-policy-footer',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './policy-footer.component.html',
  styleUrls: ['./policy-footer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PolicyFooterComponent {}
