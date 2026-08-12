import React from 'react';
import { X, Clock, RotateCcw, Trash2, ShieldCheck, AlertCircle } from 'lucide-react';
import { MigrationSnapshot } from '../types/migration';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: MigrationSnapshot[];
  onRestore: (snapshot: MigrationSnapshot) => void;
  onDelete: (id: string) => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  isOpen,
  onClose,
  snapshots,
  onRestore,
  onDelete
}) => {
  if (!isOpen) return null;

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col animate-slide-in-right">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-3 text-brand-400">
            <Clock className="h-5 w-5" />
            <h2 className="text-lg font-bold">Version History</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {snapshots.length === 0 ? (
            <div className="text-center text-slate-500 py-10 space-y-3">
              <Clock className="h-10 w-10 mx-auto opacity-30" />
              <p>No snapshots found for this project.</p>
              <p className="text-sm">Create a snapshot to save your mappings before making large changes.</p>
            </div>
          ) : (
            snapshots.map((snap) => (
              <div 
                key={snap.id} 
                className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-brand-500/30 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-200">{snap.description}</h3>
                    <div className="text-xs text-slate-400 mt-1 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDate(snap.timestamp)}
                    </div>
                  </div>
                  <button
                    onClick={() => onDelete(snap.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
                    title="Delete Snapshot"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {snap.stats && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded flex items-center">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      {snap.stats.autoMatchedCount} Matched
                    </div>
                    <div className="bg-amber-500/10 text-amber-400 p-2 rounded flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {snap.stats.needsReviewCount} Review
                    </div>
                  </div>
                )}

                <button
                  onClick={() => onRestore(snap)}
                  className="w-full mt-2 flex items-center justify-center space-x-2 bg-slate-800 hover:bg-brand-600 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Restore Version</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
