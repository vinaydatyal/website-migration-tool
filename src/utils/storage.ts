import localforage from 'localforage';
import { MigrationProject, MigrationSnapshot } from '../types/migration';
import { supabase } from './supabaseClient';

const projectStore = localforage.createInstance({
  name: 'MigrateShieldDB',
  storeName: 'migrationProjects'
});

const snapshotStore = localforage.createInstance({
  name: 'MigrateShieldDB',
  storeName: 'projectSnapshots'
});

export async function saveProjectToIndexedDB(project: MigrationProject): Promise<void> {
  try {
    // Auto-update timestamp
    project.updatedAt = new Date().toISOString();
    if (!project.createdAt) {
      project.createdAt = project.updatedAt;
    }

    // 1. Always save to local IndexedDB first for instant, offline, quota-free reliability
    await projectStore.setItem(project.id, project);

    // 2. Sync to Supabase in the background
    supabase
      .from('migrationProjects')
      .upsert({
        id: project.id,
        project_data: project,
        updated_at: project.updatedAt
      })
      .then(({ error }) => {
        if (error) console.warn('Supabase sync notice:', error.message);
      })
      .catch((e) => console.warn('Supabase connection notice:', e));
  } catch (error) {
    console.error('Failed to save project to IndexedDB:', error);
  }
}

export async function loadProjectFromIndexedDB(id: string): Promise<MigrationProject | null> {
  try {
    // 1. Check local IndexedDB first
    const local = await projectStore.getItem<MigrationProject>(id);
    if (local) return local;

    // 2. Fall back to Supabase if not found locally
    const { data, error } = await supabase
      .from('migrationProjects')
      .select('project_data')
      .eq('id', id)
      .single();

    if (!error && data?.project_data) {
      const proj = data.project_data as MigrationProject;
      await projectStore.setItem(id, proj).catch(() => {});
      return proj;
    }
    return null;
  } catch (error) {
    console.error('Failed to load project:', error);
    return null;
  }
}

export async function getAllProjectsFromIndexedDB(): Promise<MigrationProject[]> {
  const localProjects: MigrationProject[] = [];
  try {
    // 1. Load all local projects from IndexedDB
    await projectStore.iterate<MigrationProject, void>((val) => {
      if (val && val.id) {
        localProjects.push(val);
      }
    });

    // 2. Attempt to pull from Supabase and merge
    try {
      const { data, error } = await supabase
        .from('migrationProjects')
        .select('project_data, updated_at')
        .order('updated_at', { ascending: false });

      if (!error && data) {
        const localMap = new Map(localProjects.map(p => [p.id, p]));
        for (const row of data) {
          const remoteP = row.project_data as MigrationProject;
          if (remoteP && remoteP.id) {
            const existing = localMap.get(remoteP.id);
            if (!existing) {
              localProjects.push(remoteP);
              projectStore.setItem(remoteP.id, remoteP).catch(() => {});
            } else {
              const remoteTime = new Date(remoteP.updatedAt || 0).getTime();
              const localTime = new Date(existing.updatedAt || 0).getTime();
              // Prefer whichever copy has more source/target data or is newer
              const remoteCount = (remoteP.sourceEntries?.length || 0) + (remoteP.targetEntries?.length || 0);
              const localCount = (existing.sourceEntries?.length || 0) + (existing.targetEntries?.length || 0);
              if (remoteCount > localCount || (remoteCount === localCount && remoteTime > localTime)) {
                Object.assign(existing, remoteP);
                projectStore.setItem(remoteP.id, remoteP).catch(() => {});
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Using offline projects, Supabase unavailable:', e);
    }

    return localProjects.sort((a, b) => 
      new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    );
  } catch (error) {
    console.error('Failed to get all projects:', error);
    return localProjects;
  }
}

export async function deleteProjectFromIndexedDB(id: string): Promise<void> {
  try {
    // 1. Delete locally
    await projectStore.removeItem(id);
    
    // 2. Delete from Supabase
    supabase.from('projectSnapshots').delete().eq('project_id', id).catch(() => {});
    supabase.from('migrationProjects').delete().eq('id', id).catch(() => {});
  } catch (error) {
    console.error('Failed to delete project:', error);
  }
}

export async function saveSnapshot(projectId: string, snapshot: MigrationSnapshot): Promise<void> {
  try {
    if (!snapshot.timestamp) {
      snapshot.timestamp = new Date().toISOString();
    }
    // 1. Save locally
    await snapshotStore.setItem(snapshot.id, { ...snapshot, projectId });

    // 2. Sync to Supabase
    supabase
      .from('projectSnapshots')
      .upsert({
        id: snapshot.id,
        project_id: projectId,
        snapshot_data: snapshot,
        created_at: snapshot.timestamp
      })
      .catch(() => {});
  } catch (error) {
    console.error('Failed to save snapshot:', error);
  }
}

export async function getSnapshots(projectId: string): Promise<MigrationSnapshot[]> {
  const localSnapshots: MigrationSnapshot[] = [];
  try {
    await snapshotStore.iterate<any, void>((val) => {
      if (val && val.projectId === projectId) {
        localSnapshots.push(val);
      }
    });

    try {
      const { data, error } = await supabase
        .from('projectSnapshots')
        .select('snapshot_data, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const localMap = new Map(localSnapshots.map(s => [s.id, s]));
        for (const row of data) {
          const snap = row.snapshot_data as MigrationSnapshot;
          if (snap && snap.id && !localMap.has(snap.id)) {
            localSnapshots.push(snap);
            snapshotStore.setItem(snap.id, { ...snap, projectId }).catch(() => {});
          }
        }
      }
    } catch (e) {}

    return localSnapshots.sort((a, b) => 
      new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );
  } catch (error) {
    console.error('Failed to get snapshots:', error);
    return localSnapshots;
  }
}

export async function deleteSnapshot(id: string): Promise<void> {
  try {
    await snapshotStore.removeItem(id);
    supabase.from('projectSnapshots').delete().eq('id', id).catch(() => {});
  } catch (error) {
    console.error('Failed to delete snapshot:', error);
  }
}
