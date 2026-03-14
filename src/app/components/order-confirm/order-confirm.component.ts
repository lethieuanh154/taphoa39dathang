import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-order-confirm',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-confirm.component.html',
  styleUrls: ['./order-confirm.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderConfirmComponent implements OnInit {
  orderId = '';

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.orderId = this.route.snapshot.paramMap.get('orderId') || '';
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
