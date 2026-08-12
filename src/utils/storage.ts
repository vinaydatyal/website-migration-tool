import { MigrationProject, MigrationSnapshot } from '../types/migration';

const DB_NAME = 'MigrateShieldDB';
const STORE_NAME = 'migrationProjects';
const SNAPSHOT_STORE_NAME = 'projectSnapshots';
const DB_VERSION = 3; // Upgraded version for snapshots

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE_NAME)) {
        const snapshotStore = db.createObjectStore(SNAPSHOT_STORE_NAME, { keyPath: 'id' });
        snapshotStore.createIndex('projectId', 'projectId', { unique: false });
      }
    };

    request.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    request.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

export async function saveProjectToIndexedDB(project: MigrationProject): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      // Auto-update timestamp
      project.updatedAt = new Date().toISOString();
      if (!project.createdAt) {
        project.createdAt = project.updatedAt;
      }

      store.put(project, project.id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Failed to save project to IndexedDB:', error);
  }
}

export async function loadProjectFromIndexedDB(id: string): Promise<MigrationProject | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load project from IndexedDB:', error);
    return null;
  }
}

export async function getAllProjectsFromIndexedDB(): Promise<MigrationProject[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by updatedAt descending
        const projects = (request.result || []).sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        resolve(projects);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get all projects from IndexedDB:', error);
    return [];
  }
}

export async function deleteProjectFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Failed to delete project from IndexedDB:', error);
  }
}

// --- Snapshot Operations ---

export async function saveSnapshotToIndexedDB(snapshot: MigrationSnapshot): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SNAPSHOT_STORE_NAME);
      
      if (!snapshot.timestamp) {
        snapshot.timestamp = new Date().toISOString();
      }

      store.put(snapshot);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Failed to save snapshot to IndexedDB:', error);
  }
}

export async function getSnapshotsForProject(projectId: string): Promise<MigrationSnapshot[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE_NAME, 'readonly');
      const store = tx.objectStore(SNAPSHOT_STORE_NAME);
      const index = store.index('projectId');
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        // Sort by timestamp descending (newest first)
        const snapshots = (request.result || []).sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        resolve(snapshots);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get snapshots from IndexedDB:', error);
    return [];
  }
}

export async function deleteSnapshotFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SNAPSHOT_STORE_NAME);
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Failed to delete snapshot from IndexedDB:', error);
  }
}

export async function deleteAllSnapshotsForProject(projectId: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SNAPSHOT_STORE_NAME);
      const index = store.index('projectId');
      const request = index.getAllKeys(projectId);

      request.onsuccess = () => {
        const keys = request.result;
        keys.forEach(key => store.delete(key));
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Failed to delete all snapshots for project:', error);
  }
}
