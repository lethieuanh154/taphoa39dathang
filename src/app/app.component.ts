import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SnackbarComponent } from './components/snackbar/snackbar.component';
import { ChatBubbleComponent } from './components/chat-bubble/chat-bubble.component';
import { BubbleHintComponent } from './components/bubble-hint/bubble-hint.component';
import { DraggableBubbleDirective } from './directives/draggable-bubble.directive';

const IDENTITY_KEY = 'sm_customer_identity';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, SnackbarComponent, ChatBubbleComponent, DraggableBubbleDirective, BubbleHintComponent],
  template: `
    <router-outlet></router-outlet>
    <app-snackbar />
    @defer (when customerIdentity) {
      <app-chat-bubble appDraggableBubble [storageKey]="'chat-bubble-pos'"></app-chat-bubble>
      <!-- Hint 1 lan: chi cho khach biet 2 bubble keo duoc -->
      <app-bubble-hint></app-bubble-hint>
    }
  `,
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'Song Minh - Đặt hàng online';

  get customerIdentity(): string {
    return localStorage.getItem(IDENTITY_KEY) || '';
  }
}
