import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, BehaviorSubject, firstValueFrom } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  id?: string;
  senderId: string;
  senderName: string;
  senderType: 'customer' | 'staff';
  message: string;
  conversationId: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private socket: Socket | null = null;
  private newMessage$ = new Subject<ChatMessage>();
  private messages$ = new BehaviorSubject<ChatMessage[]>([]);

  constructor(private http: HttpClient) {}

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(`${environment.domainUrl}/api/websocket/messages`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
      timeout: 10000
    });

    this.socket.on('message_created', (msg: ChatMessage) => {
      this.newMessage$.next(msg);
      const current = this.messages$.value;
      this.messages$.next([...current, msg]);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  getNewMessage$() {
    return this.newMessage$.asObservable();
  }

  getMessages$() {
    return this.messages$.asObservable();
  }

  async sendMessage(senderId: string, senderName: string, message: string): Promise<ChatMessage> {
    const body = {
      senderId,
      senderName,
      senderType: 'customer',
      message,
      conversationId: senderId
    };
    const res = await firstValueFrom(this.http.post<{ status: string; message: ChatMessage }>(
      `${environment.domainUrl}/api/chat/send`, body
    ));
    return res.message;
  }

  async loadMessages(conversationId: string): Promise<ChatMessage[]> {
    const msgs = await firstValueFrom(this.http.get<ChatMessage[]>(
      `${environment.domainUrl}/api/chat/messages/${conversationId}`
    ));
    const result = msgs || [];
    this.messages$.next(result);
    return result;
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.newMessage$.complete();
    this.messages$.complete();
  }
}
