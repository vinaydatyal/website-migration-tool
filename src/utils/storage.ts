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

async function getUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id;
}

import toast from 'react-hot-toast';

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
    const userId = await getUserId();
    if (userId) {
      supabase
        .from('migrationProjects')
        .upsert({
          id: project.id,
          project_data: project,
          updated_at: project.updatedAt,
          user_id: userId
        })
        .then(({ error }) => {
          if (error) console.warn('Supabase sync notice:', error.message);
        })
        .then(undefined, (e) => console.warn('Supabase connection notice:', e));
    }
  } catch (error: any) {
    console.error('Failed to save project to IndexedDB:', error);
    toast.error(`Failed to save project data: ${error.message || 'Storage full or object too large'}`);
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
      await projectStore.setItem(id, proj).then(undefined, () => {});
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
        // Filter out soft-deleted projects
        if (!(val as any).isDeleted) {
          localProjects.push(val);
        }
      }
    });

    // 2. Attempt to pull from Supabase and merge
    try {
      const { data: remoteData, error } = await supabase.from('migrationProjects').select('id, project_data, updated_at');
      if (!error && remoteData) {
        for (const row of remoteData) {
          const remoteP = row.project_data as MigrationProject;
          if ((remoteP as any).isDeleted) continue;
          
          const remoteTime = new Date(remoteP.updatedAt || 0).getTime();
          const existing = localProjects.find(p => p.id === remoteP.id);
          
          // Check if it exists in DB as deleted (so it didn't make it to localProjects array)
          const dbItem = await projectStore.getItem<MigrationProject>(remoteP.id);
          if (dbItem && (dbItem as any).isDeleted) {
             continue; // Don't restore if soft-deleted locally
          }

          if (!existing) {
            projectStore.setItem(remoteP.id, remoteP).then(undefined, () => {});
            localProjects.push(remoteP);
          } else {
            // Overwrite local if remote is newer
            const localTime = new Date(existing.updatedAt || 0).getTime();
            if (remoteTime > localTime) {
              const remoteCount = remoteP.sourceEntries?.length || 0;
              const localCount = existing.sourceEntries?.length || 0;
              if (remoteCount > localCount || (remoteCount === localCount && remoteTime > localTime)) {
                Object.assign(existing, remoteP);
                projectStore.setItem(remoteP.id, remoteP).then(undefined, () => {});
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
    // 1. Soft delete locally to prevent re-sync from Supabase if remote delete fails
    const existing = await projectStore.getItem<MigrationProject>(id);
    if (existing) {
      (existing as any).isDeleted = true;
      await projectStore.setItem(id, existing);
    }
    
    // 2. Delete from Supabase (await to prevent race condition when fetching projects immediately after)
    const { error: snapErr } = await supabase.from('projectSnapshots').delete().eq('project_id', id);
    if (snapErr) console.warn('Failed to delete snapshots from Supabase:', snapErr);

    const { error: projErr } = await supabase.from('migrationProjects').delete().eq('id', id);
    if (projErr) console.warn('Failed to delete project from Supabase:', projErr);
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
    const userId = await getUserId();
    if (userId) {
      supabase
        .from('projectSnapshots')
        .upsert({
          id: snapshot.id,
          project_id: projectId,
          snapshot_data: snapshot,
          created_at: snapshot.timestamp,
          user_id: userId
        })
        .then(undefined, () => {});
    }
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
            snapshotStore.setItem(snap.id, { ...snap, projectId }).then(undefined, () => {});
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
    supabase.from('projectSnapshots').delete().eq('id', id).then(undefined, () => {});
  } catch (error) {
    console.error('Failed to delete snapshot:', error);
  }
}
