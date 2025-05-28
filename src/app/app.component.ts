import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-root',
  imports: [RouterModule],
  template: `
    <main>
      <section class="content">
        <router-outlet></router-outlet>
      </section>
    </main>
  `,
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'Tạp hóa 39';
}
