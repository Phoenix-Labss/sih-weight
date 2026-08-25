/**
 * IndexedDB and local storage adapter for offline mobile inspection caching.
 */

export interface CachedOfflineTask {
  sessionId: string;
  applicationNumber: string;
  instrumentSerial: string;
  category: string;
  accuracyClass: string;
  maxCapacity: string;
  observations: any[];
  stamps: any[];
  status: 'PENDING_INSPECTION' | 'COMPLETED_OFFLINE' | 'SYNCED';
  updatedAt: string;
}

const DB_KEY = 'lm_offline_tasks_store';

export const OfflineStorage = {
  saveTask(task: CachedOfflineTask): void {
    const tasks = OfflineStorage.getTasks();
    const index = tasks.findIndex((t) => t.sessionId === task.sessionId);
    if (index >= 0) {
      tasks[index] = task;
    } else {
      tasks.push(task);
    }
    localStorage.setItem(DB_KEY, JSON.stringify(tasks));
  },

  getTasks(): CachedOfflineTask[] {
    const data = localStorage.getItem(DB_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  getTask(sessionId: string): CachedOfflineTask | undefined {
    return OfflineStorage.getTasks().find((t) => t.sessionId === sessionId);
  },

  clearSynced(): void {
    const pending = OfflineStorage.getTasks().filter((t) => t.status !== 'SYNCED');
    localStorage.setItem(DB_KEY, JSON.stringify(pending));
  },
};
