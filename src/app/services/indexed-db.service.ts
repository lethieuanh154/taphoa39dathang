import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';

@Injectable({ providedIn: 'root' })
export class IndexedDBService {
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private initPromise: Promise<IDBPDatabase> | null = null;

  private getDB(
    dbName: string,
    version: number,
    upgradeFn?: (db: IDBPDatabase, oldVersion: number) => void
  ): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      if (!this.initPromise) {
        // DB not initialized yet - open with upgrade function if provided
        this.dbPromise = openDB(dbName, version, {
          upgrade(db, oldVersion) {
            upgradeFn?.(db, oldVersion);
          }
        });
      } else {
        // Wait for init() to complete first, then reuse its connection
        this.dbPromise = this.initPromise;
      }
    }
    return this.dbPromise;
  }

  async init(
    dbName: string,
    version: number,
    upgradeFn: (db: IDBPDatabase, oldVersion: number) => void
  ): Promise<void> {
    // Store init promise so getDB() can wait for it if called before init completes
    this.initPromise = openDB(dbName, version, {
      upgrade(db, oldVersion) {
        upgradeFn(db, oldVersion);
      }
    });
    this.dbPromise = this.initPromise;
    await this.dbPromise;
  }

  async getAll<T>(dbName: string, version: number, storeName: string): Promise<T[]> {
    const db = await this.getDB(dbName, version);
    return db.getAll(storeName);
  }

  async getByKey<T>(dbName: string, version: number, storeName: string, key: IDBValidKey): Promise<T | undefined> {
    const db = await this.getDB(dbName, version);
    return db.get(storeName, key);
  }

  async getAllByIndex<T>(dbName: string, version: number, storeName: string, indexName: string, key: IDBValidKey): Promise<T[]> {
    const db = await this.getDB(dbName, version);
    return db.getAllFromIndex(storeName, indexName, key);
  }

  async put<T>(dbName: string, version: number, storeName: string, value: T): Promise<void> {
    const db = await this.getDB(dbName, version);
    await db.put(storeName, value as any);
  }

  async putMany<T>(dbName: string, version: number, storeName: string, values: T[]): Promise<void> {
    const db = await this.getDB(dbName, version);
    const tx = db.transaction(storeName, 'readwrite');
    for (const value of values) {
      tx.store.put(value as any);
    }
    await tx.done;
  }

  async clear(dbName: string, version: number, storeName: string): Promise<void> {
    const db = await this.getDB(dbName, version);
    await db.clear(storeName);
  }

  async count(dbName: string, version: number, storeName: string): Promise<number> {
    const db = await this.getDB(dbName, version);
    return db.count(storeName);
  }

  async delete(dbName: string, version: number, storeName: string, key: IDBValidKey): Promise<void> {
    const db = await this.getDB(dbName, version);
    await db.delete(storeName, key);
  }
}
