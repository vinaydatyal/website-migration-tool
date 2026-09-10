import localforage from 'localforage';
import { MigrationProject, MigrationSnapshot } from '../types/migration';

const projectStore = localforage.createInstance({
  name: 'WebsiteMigrationTool',
  storeName: 'projects'
});

const snapshotStore = localforage.createInstance({
  name: 'WebsiteMigrationTool',
  storeName: 'snapshots'
});

interface SnapshotWrapper {
  projectId: string;
  snapshot: MigrationSnapshot;
}

export async function saveProjectToIndexedDB(project: MigrationProject): Promise<void> {
  try {
    project.updatedAt = new Date().toISOString();
    if (!project.createdAt) {
      project.createdAt = project.updatedAt;
    }
    await projectStore.setItem(project.id, project);
  } catch (error) {
    console.error('Failed to save project to IndexedDB:', error);
  }
}

export async function loadProjectFromIndexedDB(id: string): Promise<MigrationProject | null> {
  try {
    const project = await projectStore.getItem<MigrationProject>(id);
    return project || null;
  } catch (error) {
    console.error('Failed to load project from IndexedDB:', error);
    return null;
  }
}

export async function getAllProjectsFromIndexedDB(): Promise<MigrationProject[]> {
  try {
    const projects: MigrationProject[] = [];
    await projectStore.iterate((value: MigrationProject) => {
      projects.push(value);
    });
    return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.error('Failed to get all projects from IndexedDB:', error);
    return [];
  }
}

export async function deleteProjectFromIndexedDB(id: string): Promise<void> {
  try {
    await projectStore.removeItem(id);
    
    const snapshotsToDelete: string[] = [];
    await snapshotStore.iterate((value: SnapshotWrapper, key: string) => {
      if (value.projectId === id) {
        snapshotsToDelete.push(key);
      }
    });
    
    for (const snapId of snapshotsToDelete) {
      await snapshotStore.removeItem(snapId);
    }
  } catch (error) {
    console.error('Failed to delete project from IndexedDB:', error);
  }
}

export async function saveSnapshot(projectId: string, snapshot: MigrationSnapshot): Promise<void> {
  try {
    await snapshotStore.setItem(snapshot.id, { projectId, snapshot });
  } catch (error) {
    console.error('Failed to save snapshot to IndexedDB:', error);
  }
}

export async function getSnapshots(projectId: string): Promise<MigrationSnapshot[]> {
  try {
    const snapshots: MigrationSnapshot[] = [];
    await snapshotStore.iterate((value: SnapshotWrapper) => {
      if (value.projectId === projectId) {
        snapshots.push(value.snapshot);
      }
    });
    return snapshots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.error('Failed to get snapshots from IndexedDB:', error);
    return [];
  }
}

export async function deleteSnapshot(id: string): Promise<void> {
  try {
    await snapshotStore.removeItem(id);
  } catch (error) {
    console.error('Failed to delete snapshot from IndexedDB:', error);
  }
}
