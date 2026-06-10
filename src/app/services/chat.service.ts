import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subject, BehaviorSubject, firstValueFrom } from 'rxjs';
import { SnackbarService } from './snackbar.service';
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

const CHAT_DB_NAME = 'DatHangChatDB';
const CHAT_DB_VERSION = 1;
const MESSAGES_STORE = 'messages';

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private newMessage$ = new Subject<ChatMessage>();
  private messages$ = new BehaviorSubject<ChatMessage[]>([]);

  // Firestore realtime (lazy-loaded)
  private chatApp: any = null;
  private chatDb: any = null;
  private conversationUnsub: (() => void) | null = null;
  private knownMessageIds = new Set<string>();
  private firestoreModule: any = null;

  // IndexedDB cache
  private idbPromise: Promise<any> | null = null;

  constructor(private http: HttpClient, private snackbar: SnackbarService) {}

  /**
   * Kết nối Firestore realtime cho conversation của customer.
   * Gọi connect() rồi sau đó loadMessages(conversationId) để listen.
   */
  async connect(): Promise<void> {
    await this.initFirestore();
    this.initIDB();
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
    try {
      const res = await firstValueFrom(this.http.post<{ status: string; message: ChatMessage }>(
        `${environment.domainUrl}/api/chat/send`, body
      ));
      // Cache sent message
      if (res.message?.id) {
        this.saveMessagesToIDB([res.message]);
      }
      return res.message;
    } catch (err) {
      if (!(err instanceof HttpErrorResponse && err.status >= 500)) {
        this.snackbar.error('Gửi tin nhắn thất bại. Vui lòng thử lại.');
      }
      throw err;
    }
  }

  async loadMessages(conversationId: string): Promise<ChatMessage[]> {
    // Unsubscribe previous listener
    this.conversationUnsub?.();

    // Load cached messages from IndexedDB first (instant UI)
    const cached = await this.loadMessagesFromIDB(conversationId);
    if (cached.length > 0) {
      this.messages$.next(cached);
      cached.forEach(m => { if (m.id) this.knownMessageIds.add(m.id); });
    }

    if (!this.chatDb) {
      // Fallback to HTTP if Firestore not available
      const msgs = await firstValueFrom(this.http.get<ChatMessage[]>(
        `${environment.domainUrl}/api/chat/messages/${conversationId}`
      ));
      const result = msgs || [];
      this.messages$.next(result);
      this.saveMessagesToIDB(result);
      return result;
    }

    // Listen to conversation via Firestore onSnapshot
    const fs = this.firestoreModule;
    const messagesRef = fs.collection(this.chatDb, 'chatMessages');
    const q = fs.query(
      messagesRef,
      fs.where('conversationId', '==', conversationId),
      fs.orderBy('timestamp', 'asc')
    );

    return new Promise<ChatMessage[]>((resolve) => {
      let resolved = false;
      let isInitial = true;

      this.conversationUnsub = fs.onSnapshot(q, (snapshot: any) => {
        const msgs: ChatMessage[] = snapshot.docs.map((doc: any) =>
          this.docToMessage(doc.id, doc.data())
        );
        this.messages$.next(msgs);

        // Sync to IndexedDB
        this.saveMessagesToIDB(msgs);

        if (isInitial) {
          isInitial = false;
          snapshot.docs.forEach((doc: any) => this.knownMessageIds.add(doc.id));
        } else {
          // Emit new messages only
          snapshot.docChanges().forEach((change: any) => {
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

  private async initFirestore(): Promise<void> {
    if (this.chatDb) return;
    const config = (environment as any).firebaseChat;
    if (!config?.projectId) {
      console.warn('[ChatService] firebaseChat config not found, Firestore realtime disabled');
      return;
    }

    const firebaseApp = await import('firebase/app');
    this.firestoreModule = await import('firebase/firestore');

    const appName = 'chat-realtime';
    const existing = firebaseApp.getApps().find(app => app.name === appName);
    this.chatApp = existing || firebaseApp.initializeApp(config, appName);
    this.chatDb = this.firestoreModule.getFirestore(this.chatApp);
  }

  private async initIDB(): Promise<void> {
    if (this.idbPromise) return;
    const { openDB } = await import('idb');
    this.idbPromise = openDB(CHAT_DB_NAME, CHAT_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
          const store = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
          store.createIndex('conversationId', 'conversationId', { unique: false });
        }
      }
    });
  }

  private async loadMessagesFromIDB(conversationId: string): Promise<ChatMessage[]> {
    try {
      const db = await this.idbPromise;
      if (!db) return [];
      const msgs = await db.getAllFromIndex(MESSAGES_STORE, 'conversationId', conversationId);
      return msgs.sort((a: ChatMessage, b: ChatMessage) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    } catch {
      return [];
    }
  }

  private async saveMessagesToIDB(messages: ChatMessage[]): Promise<void> {
    try {
      const db = await this.idbPromise;
      if (!db) return;
      const tx = db.transaction(MESSAGES_STORE, 'readwrite');
      for (const msg of messages) {
        if (msg.id) tx.store.put(msg);
      }
      await tx.done;
    } catch {
      // Silent fail - cache is best-effort
    }
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
