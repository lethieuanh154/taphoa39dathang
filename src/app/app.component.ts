import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SnackbarComponent } from './components/snackbar/snackbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, SnackbarComponent],
  template: `<router-outlet></router-outlet><app-snackbar />`,
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'Song Minh - Đặt hàng online';
}
