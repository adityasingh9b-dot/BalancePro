import { UserProfile, UserRole } from "../types";

const STORAGE_KEY = 'balancepro_local_metadata';
const DB_NAME = 'BalanceProInternal';
const VIDEO_STORE = 'videos_blobs';
const IMAGE_STORE = 'images_blobs';

type Listener = (data: any) => void;

class MockDatabase {
  private data: any;
  private listeners: { [path: string]: Listener[] } = {};
  private db: IDBDatabase | null = null;

  constructor() {
    const defaults = {
      users: {},
      active_class: null,
      schedules: [],
      video_categories: [],
      videos: [],
      prescriptions: {},
      trending_banner: null // { id: string, updatedOn: number }
    };

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : {};
      this.data = { ...defaults, ...parsed };
      
      if (!this.data.users || typeof this.data.users !== 'object') this.data.users = {};
      if (!Array.isArray(this.data.video_categories)) this.data.video_categories = [];
      if (!Array.isArray(this.data.videos)) this.data.videos = [];
      if (!Array.isArray(this.data.schedules)) this.data.schedules = [];
      if (!this.data.prescriptions || typeof this.data.prescriptions !== 'object') this.data.prescriptions = {};
    } catch (e) {
      console.error("Failed to load BalancePro metadata:", e);
      this.data = defaults;
    }

    const request = indexedDB.open(DB_NAME, 2); // Incremented version to add Image store
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(VIDEO_STORE)) {
        db.createObjectStore(VIDEO_STORE);
      }
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE);
      }
    };
    request.onsuccess = (e: any) => {
      this.db = e.target.result;
    };

    const trainerPhone = '7355519301';
    const trainerUid = `user_${trainerPhone}`;
    if (!this.data.users[trainerUid]) {
      this.data.users[trainerUid] = {
        uid: trainerUid,
        name: 'Nitesh Tyagi',
        phone: trainerPhone,
        role: UserRole.TRAINER,
        registeredOn: Date.now(),
      };
      this.save();
    }
  }

  private save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    this.notifyAll();
  }

  private notifyAll() {
    Object.keys(this.listeners).forEach(path => {
      const val = this.getNestedValue(this.data, path);
      this.listeners[path].forEach(cb => cb(val));
    });
  }

  private getNestedValue(obj: any, path: string) {
    if (!path) return obj;
    return path.split('/').reduce((prev, curr) => prev && prev[curr], obj);
  }

  private setNestedValue(obj: any, path: string, value: any) {
    const parts = path.split('/');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }

  public onValue(path: string, callback: (data: any) => void) {
    if (!this.listeners[path]) this.listeners[path] = [];
    this.listeners[path].push(callback);
    callback(this.getNestedValue(this.data, path));
    return () => {
      this.listeners[path] = this.listeners[path].filter(cb => cb !== callback);
    };
  }

  public onUsers(callback: (users: UserProfile[]) => void) {
    return this.onValue('users', (data) => {
      callback(Object.values(data || {}));
    });
  }

  public async set(path: string, value: any) {
    this.setNestedValue(this.data, path, value);
    this.save();
  }

  public async remove(path: string) {
    const parts = path.split('/');
    let current = this.data;
    const lastPart = parts[parts.length - 1];
    
    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
      if (!current) return;
    }

    if (Array.isArray(current)) {
      const index = parseInt(lastPart, 10);
      if (!isNaN(index)) {
        current.splice(index, 1);
      }
    } else {
      delete current[lastPart];
    }
    
    this.save();
  }

  public async getAllUsers(): Promise<UserProfile[]> {
    return Object.values(this.data.users || {});
  }

  public async storeVideoBlob(id: string, blob: Blob) {
    if (!this.db) return;
    const tx = this.db.transaction(VIDEO_STORE, 'readwrite');
    tx.objectStore(VIDEO_STORE).put(blob, id);
  }

  public async getVideoBlob(id: string): Promise<string | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db!.transaction(VIDEO_STORE, 'readonly');
      const request = tx.objectStore(VIDEO_STORE).get(id);
      request.onsuccess = () => {
        if (request.result) {
          resolve(URL.createObjectURL(request.result));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  }

  public async storeImageBlob(id: string, blob: Blob) {
    if (!this.db) return;
    const tx = this.db.transaction(IMAGE_STORE, 'readwrite');
    tx.objectStore(IMAGE_STORE).put(blob, id);
  }

  public async getImageBlob(id: string): Promise<string | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db!.transaction(IMAGE_STORE, 'readonly');
      const request = tx.objectStore(IMAGE_STORE).get(id);
      request.onsuccess = () => {
        if (request.result) {
          resolve(URL.createObjectURL(request.result));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  }
}

export const db = new MockDatabase();