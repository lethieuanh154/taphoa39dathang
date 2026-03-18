import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChatService, ChatMessage } from '../../services/chat.service';

const IDENTITY_KEY = 'sm_customer_identity';
const IDENTITY_NAME_KEY = 'sm_customer_name';
const ZALO_OA_URL = 'https://zalo.me/1420769616971124037';
const LAST_READ_KEY = 'sm_chat_last_read';

@Component({
  selector: 'app-chat-bubble',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Floating Chat Bubble -->
    <button class="chat-fab" (click)="toggleChat()" [class.chat-fab-active]="isOpen">
      <svg *ngIf="!isOpen" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
      <svg *ngIf="isOpen" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      <span class="unread-badge" *ngIf="!isOpen && unreadCount > 0">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>

    <!-- Chatbox -->
    <div class="chatbox" *ngIf="isOpen">
      <div class="chatbox-header">
        <span>Chat với Song Minh</span>
        <a class="zalo-link" [href]="zaloUrl" target="_blank" rel="noopener">
          <i style="font-size: 20px;" class="fa-solid fa-hand-point-right"></i><img src="https://page.widget.zalo.me/static/images/2.0/Logo.svg" alt="Zalo" width="20" height="20" />
         Chat qua Zalo
        </a>
      </div>

      <div class="chatbox-messages" #messagesContainer>
        <div *ngFor="let msg of messages" class="chat-msg" [class.chat-msg-mine]="msg.senderType === 'customer'" [class.chat-msg-staff]="msg.senderType === 'staff'">
          <div class="msg-bubble">{{ msg.message }}</div>
          <div class="msg-time">{{ formatTime(msg.timestamp) }}</div>
        </div>
        <div *ngIf="messages.length === 0" class="chat-empty">
          Gửi tin nhắn cho chúng tôi!
        </div>
      </div>

      <div class="chatbox-input">
        <input
          [(ngModel)]="messageText"
          placeholder="Nhập tin nhắn..."
          (keydown.enter)="sendMessage()"
          [disabled]="isSending"
        />
        <button class="send-btn" (click)="sendMessage()" [disabled]="!messageText.trim() || isSending">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { position: fixed; bottom: 20px; right: 20px; z-index: 1000; }

    .chat-fab {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: #1976d2;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(25,118,210,0.4);
      transition: transform 0.2s, background 0.2s;
    }
    .chat-fab:hover { transform: scale(1.08); }
    .chat-fab-active { background: #d32f2f; }

    .unread-badge {
      position: absolute;
      top: -4px; right: -4px;
      min-width: 20px; height: 20px;
      border-radius: 10px;
      background: #d32f2f;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 5px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      line-height: 1;
    }

    .chatbox {
      position: absolute;
      bottom: 68px; right: 0;
      width: 340px;
      max-height: 460px;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .chatbox-header {
      background: #1976d2;
      color: #fff;
      padding: 14px 16px;
      font-weight: 600;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .zalo-link {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #fff;
      text-decoration: none;
      font-size: 12px;
      font-weight: 500;
      background: rgba(255,255,255,0.15);
      padding: 4px 10px;
      border-radius: 20px;
      transition: background 0.2s;
    }
    .zalo-link:hover { background: rgba(255,255,255,0.3); }

    .chatbox-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      min-height: 200px;
      max-height: 300px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #f5f5f5;
    }

    .chat-msg { display: flex; flex-direction: column; max-width: 80%; }
    .chat-msg-mine { align-self: flex-end; align-items: flex-end; }
    .chat-msg-staff { align-self: flex-start; align-items: flex-start; }

    .msg-bubble {
      padding: 8px 14px;
      border-radius: 16px;
      font-size: 13px;
      line-height: 1.4;
      word-break: break-word;
    }
    .chat-msg-mine .msg-bubble {
      background: #1976d2;
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .chat-msg-staff .msg-bubble {
      background: #fff;
      color: #1a1a1a;
      border: 1px solid #e0e0e0;
      border-bottom-left-radius: 4px;
    }

    .msg-time {
      font-size: 10px;
      color: #999;
      margin-top: 2px;
      padding: 0 4px;
    }

    .chat-empty {
      text-align: center;
      color: #999;
      font-size: 13px;
      padding: 40px 0;
    }

    .chatbox-input {
      display: flex;
      padding: 10px 12px;
      border-top: 1px solid #e0e0e0;
      gap: 8px;
      background: #fff;
    }
    .chatbox-input input {
      flex: 1;
      border: 1px solid #e0e0e0;
      border-radius: 20px;
      padding: 8px 14px;
      font-size: 13px;
      outline: none;
    }
    .chatbox-input input:focus { border-color: #1976d2; }

    .send-btn {
      width: 38px; height: 38px;
      border-radius: 50%;
      background: #1976d2;
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .send-btn:disabled { background: #b0bec5; cursor: not-allowed; }
    .send-btn:not(:disabled):hover { background: #1565c0; }

    @media (max-width: 400px) {
      .chatbox { width: calc(100vw - 32px); right: -4px; }
    }
  `]
})
export class ChatBubbleComponent implements OnInit, OnDestroy {
  isOpen = false;
  messages: ChatMessage[] = [];
  messageText = '';
  isSending = false;
  unreadCount = 0;
  zaloUrl = ZALO_OA_URL;

  private sub?: Subscription;
  private newMsgSub?: Subscription;
  private identity = '';
  private customerName = '';

  constructor(private chatService: ChatService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.identity = localStorage.getItem(IDENTITY_KEY) || '';
    this.customerName = localStorage.getItem(IDENTITY_NAME_KEY) || this.identity;
    this.chatService.connect();

    // Load messages ngay từ đầu để đếm unread
    if (this.identity) {
      this.chatService.loadMessages(this.identity);
    }

    this.sub = this.chatService.getMessages$().subscribe(msgs => {
      this.messages = msgs;
      // Đếm unread staff messages dựa trên lastRead timestamp
      if (!this.isOpen) {
        const lastRead = localStorage.getItem(LAST_READ_KEY) || '';
        this.unreadCount = msgs.filter(m =>
          m.senderType === 'staff' && m.timestamp > lastRead
        ).length;
      }
      this.cdr.markForCheck();
      setTimeout(() => this.scrollToBottom(), 50);
    });

    // Real-time: tăng unread khi có tin nhắn mới từ staff
    this.newMsgSub = this.chatService.getNewMessage$().subscribe(msg => {
      if (msg.senderType === 'staff' && !this.isOpen) {
        this.unreadCount++;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.newMsgSub?.unsubscribe();
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      // Đánh dấu đã đọc
      this.unreadCount = 0;
      localStorage.setItem(LAST_READ_KEY, new Date().toISOString());
      if (this.identity) {
        this.chatService.loadMessages(this.identity);
      }
    }
    this.cdr.markForCheck();
  }

  async sendMessage(): Promise<void> {
    const text = this.messageText.trim();
    if (!text || this.isSending) return;

    this.isSending = true;
    this.cdr.markForCheck();

    try {
      await this.chatService.sendMessage(this.identity, this.customerName, text);
      this.messageText = '';
    } catch (err) {
      console.error('[Chat] Send failed:', err);
    }

    this.isSending = false;
    this.cdr.markForCheck();
  }

  formatTime(timestamp: string): string {
    if (!timestamp) return '';
    // Backend lưu UTC nhưng không có 'Z', thêm 'Z' để JS parse đúng UTC → convert local
    const d = new Date(timestamp.endsWith('Z') ? timestamp : timestamp + 'Z');
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  private scrollToBottom(): void {
    const el = document.querySelector('.chatbox-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }
}
