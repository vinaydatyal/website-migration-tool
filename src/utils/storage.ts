import { MigrationProject, MigrationSnapshot } from '../types/migration';
import { supabase } from './supabaseClient';

export async function saveProjectToIndexedDB(project: MigrationProject): Promise<void> {
  try {
    // Auto-update timestamp
    project.updatedAt = new Date().toISOString();
    if (!project.createdAt) {
      project.createdAt = project.updatedAt;
    }

    const { error } = await supabase
      .from('migrationProjects')
      .upsert({
        id: project.id,
        project_data: project,
        updated_at: project.updatedAt
      });

    if (error) throw error;
  } catch (error) {
    console.error('Failed to save project to Supabase:', error);
  }
}

export async function loadProjectFromIndexedDB(id: string): Promise<MigrationProject | null> {
  try {
    const { data, error } = await supabase
      .from('migrationProjects')
      .select('project_data')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data?.project_data as MigrationProject || null;
  } catch (error) {
    console.error('Failed to load project from Supabase:', error);
    return null;
  }
}

export async function getAllProjectsFromIndexedDB(): Promise<MigrationProject[]> {
  try {
    const { data, error } = await supabase
      .from('migrationProjects')
      .select('project_data, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    
    return data?.map(row => row.project_data as MigrationProject) || [];
  } catch (error) {
    console.error('Failed to get all projects from Supabase:', error);
    return [];
  }
}

export async function deleteProjectFromIndexedDB(id: string): Promise<void> {
  try {
    // Also delete any associated snapshots via foreign key cascade or manual delete
    await supabase.from('projectSnapshots').delete().eq('project_id', id);
    const { error } = await supabase.from('migrationProjects').delete().eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to delete project from Supabase:', error);
  }
}

export async function saveSnapshot(projectId: string, snapshot: MigrationSnapshot): Promise<void> {
  try {
    const { error } = await supabase
      .from('projectSnapshots')
      .upsert({
        id: snapshot.id,
        project_id: projectId,
        snapshot_data: snapshot,
        created_at: snapshot.timestamp
      });

    if (error) throw error;
  } catch (error) {
    console.error('Failed to save snapshot to Supabase:', error);
  }
}

export async function getSnapshots(projectId: string): Promise<MigrationSnapshot[]> {
  try {
    const { data, error } = await supabase
      .from('projectSnapshots')
      .select('snapshot_data, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return data?.map(row => row.snapshot_data as MigrationSnapshot) || [];
  } catch (error) {
    console.error('Failed to get snapshots from Supabase:', error);
    return [];
  }
}

export async function deleteSnapshot(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('projectSnapshots').delete().eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Failed to delete snapshot from Supabase:', error);
  }
}
