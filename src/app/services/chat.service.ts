import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, BehaviorSubject, firstValueFrom } from 'rxjs';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore, collection, onSnapshot, query, where, orderBy,
  Firestore, Unsubscribe
} from 'firebase/firestore';
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
  private newMessage$ = new Subject<ChatMessage>();
  private messages$ = new BehaviorSubject<ChatMessage[]>([]);

  // Firestore realtime
  private chatApp: FirebaseApp | null = null;
  private chatDb: Firestore | null = null;
  private conversationUnsub: Unsubscribe | null = null;
  private knownMessageIds = new Set<string>();

  constructor(private http: HttpClient) {}

  /**
   * Kết nối Firestore realtime cho conversation của customer.
   * Gọi connect() rồi sau đó loadMessages(conversationId) để listen.
   */
  connect(): void {
    this.initFirestore();
  }

  disconnect(): void {
    this.conversationUnsub?.();
    this.conversationUnsub = null;
    this.knownMessageIds.clear();
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
    // Unsubscribe previous listener
    this.conversationUnsub?.();

    if (!this.chatDb) {
      // Fallback to HTTP if Firestore not available
      const msgs = await firstValueFrom(this.http.get<ChatMessage[]>(
        `${environment.domainUrl}/api/chat/messages/${conversationId}`
      ));
      const result = msgs || [];
      this.messages$.next(result);
      return result;
    }

    // Listen to conversation via Firestore onSnapshot
    const messagesRef = collection(this.chatDb, 'chatMessages');
    const q = query(
      messagesRef,
      where('conversationId', '==', conversationId),
      orderBy('timestamp', 'asc')
    );

    return new Promise<ChatMessage[]>((resolve) => {
      let resolved = false;
      let isInitial = true;

      this.conversationUnsub = onSnapshot(q, (snapshot) => {
        const msgs: ChatMessage[] = snapshot.docs.map(doc =>
          this.docToMessage(doc.id, doc.data())
        );
        this.messages$.next(msgs);

        if (isInitial) {
          isInitial = false;
          snapshot.docs.forEach(doc => this.knownMessageIds.add(doc.id));
        } else {
          // Emit new messages only
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added' && !this.knownMessageIds.has(change.doc.id)) {
              this.knownMessageIds.add(change.doc.id);
              this.newMessage$.next(this.docToMessage(change.doc.id, change.doc.data()));
            }
          });
        }

        if (!resolved) {
          resolved = true;
          resolve(msgs);
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.newMessage$.complete();
    this.messages$.complete();
  }

  // --- Private helpers ---

  private initFirestore(): void {
    if (this.chatDb) return;
    const config = (environment as any).firebaseChat;
    if (!config?.projectId) {
      console.warn('[ChatService] firebaseChat config not found, Firestore realtime disabled');
      return;
    }

    const appName = 'chat-realtime';
    const existing = getApps().find(app => app.name === appName);
    this.chatApp = existing || initializeApp(config, appName);
    this.chatDb = getFirestore(this.chatApp);
  }

  private docToMessage(id: string, data: any): ChatMessage {
    return {
      id,
      senderId: data['senderId'] || '',
      senderName: data['senderName'] || '',
      senderType: data['senderType'] || 'customer',
      message: data['message'] || '',
      conversationId: data['conversationId'] || '',
      timestamp: data['timestamp'] || ''
    };
  }
}
