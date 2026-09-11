import React, { useState, useEffect } from 'react';
import { 
  X, 
  Folder, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Clock,
  Layers,
  ArrowRight
} from 'lucide-react';
import { MigrationProject } from '../types/migration';
import { getAllProjectsFromIndexedDB, deleteProjectFromIndexedDB, saveProjectToIndexedDB } from '../utils/storage';
import { toast } from 'sonner';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadProject: (project: MigrationProject) => void;
  onNewProject: () => void;
  currentProjectId: string | null;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  onClose,
  onLoadProject,
  onNewProject,
  currentProjectId,
}) => {
  const [projects, setProjects] = useState<MigrationProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const fetchProjects = async () => {
    setIsLoading(true);
    const savedProjects = await getAllProjectsFromIndexedDB();
    setProjects(savedProjects);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project? This cannot be undone.')) {
      await deleteProjectFromIndexedDB(id);
      toast.success('Project deleted');
      if (id === currentProjectId) {
        onNewProject(); // Reset if deleting active project
      } else {
        fetchProjects(); // Refresh list
      }
    }
  };

  const handleSaveRename = async (project: MigrationProject, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!editName.trim()) return;
    
    const updated = { ...project, name: editName.trim() };
    await saveProjectToIndexedDB(updated);
    setEditingId(null);
    fetchProjects();
    toast.success('Project renamed');
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
              <Folder className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Project Manager</h3>
              <p className="text-xs text-slate-400">Manage your saved migration audits</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex justify-end">
          <button
            onClick={() => {
              onNewProject();
              onClose();
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-brand-500 text-slate-950 hover:bg-brand-400 shadow-md shadow-brand-500/20 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Blank Project</span>
          </button>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-950/40">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-500 mb-3"></div>
              Loading projects...
            </div>
          ) : projects.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Folder className="h-12 w-12 mx-auto mb-3 text-slate-700" />
              <p>No saved projects found.</p>
            </div>
          ) : (
            projects.map((p) => {
              const isActive = p.id === currentProjectId;
              const isEditing = editingId === p.id;

              return (
                <div 
                  key={p.id}
                  onClick={() => {
                    if (!isEditing && !isActive) {
                      onLoadProject(p);
                      onClose();
                    }
                  }}
                  className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                    isActive 
                      ? 'bg-brand-500/5 border-brand-500/30' 
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-lg ${isActive ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-800 text-slate-400'}`}>
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      {isEditing ? (
                        <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveRename(p)}
                            autoFocus
                            className="px-2 py-1 rounded bg-slate-950 border border-brand-500 text-sm font-bold text-white focus:outline-none"
                          />
                          <button onClick={(e) => handleSaveRename(p, e)} className="p-1 text-emerald-400 hover:bg-emerald-400/10 rounded">
                            <Check className="h-4 w-4" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="p-1 text-slate-400 hover:bg-slate-800 rounded">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-slate-100">{p.name || 'Untitled Project'}</h4>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-brand-500 text-slate-950">
                              Active
                            </span>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditName(p.name || 'Untitled Project');
                              setEditingId(p.id);
                            }}
                            className="p-1 text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-4 mt-1.5 text-xs text-slate-400">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>Saved: {formatDate(p.updatedAt)}</span>
                        </div>
                        {(() => {
                          const urlCount = p.stats?.totalSourceUrls ?? (p.sourceEntries?.length || p.targetEntries?.length || 0);
                          return (
                            <div className="flex items-center space-x-1">
                              <span>•</span>
                              <span>{urlCount} URLs</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {!isActive && !isEditing && (
                      <div className="text-xs font-bold text-brand-400 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Open</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    )}
                    <button
                      onClick={(e) => handleDelete(p.id, e)}
                      className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
                      title="Delete Project"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
