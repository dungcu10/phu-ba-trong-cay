// Key-value storage behind the save manager: IndexedDB in the browser, memory in tests.

export interface SaveStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export class MemoryStore implements SaveStore {
  readonly data = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

const DB_NAME = 'phu-ba-trong-cay';
const STORE_NAME = 'saves';

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** IndexedDB store. Each put is its own transaction and resolves only once committed. */
export class IndexedDbStore implements SaveStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  async get(key: string): Promise<string | null> {
    const db = await this.db();
    const value = await promisify(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key));
    return typeof value === 'string' ? value : null;
  }

  async put(key: string, value: string): Promise<void> {
    const db = await this.db();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite', { durability: 'strict' });
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.db();
    await promisify(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key));
  }
}
