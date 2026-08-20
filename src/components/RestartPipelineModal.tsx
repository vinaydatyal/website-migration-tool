import React from 'react';
import { Sparkles, Save, Trash2, X } from 'lucide-react';

interface RestartPipelineModalProps {
  onClose: () => void;
  onRestart: (keepManual: boolean) => void;
}

export const RestartPipelineModal: React.FC<RestartPipelineModalProps> = ({ onClose, onRestart }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 rounded-xl">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Restart Matching Pipeline</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Re-run the algorithm on existing data</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            You are about to re-run the matching algorithm. How would you like to handle the manual overrides you've made?
          </p>
          
          <div className="space-y-3 mt-4">
            <button
              onClick={() => onRestart(true)}
              className="w-full text-left p-4 rounded-xl border-2 border-brand-200 dark:border-brand-500/30 hover:border-brand-500 dark:hover:border-brand-400 bg-brand-50/50 dark:bg-brand-500/10 hover:bg-brand-50 dark:hover:bg-brand-500/20 transition-all flex items-start space-x-4 group"
            >
              <div className="p-2 bg-brand-100 dark:bg-brand-500/30 text-brand-600 dark:text-brand-400 rounded-lg group-hover:scale-110 transition-transform">
                <Save className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-brand-900 dark:text-brand-100 mb-1">Keep Manual Overrides</h3>
                <p className="text-xs text-brand-700/80 dark:text-brand-300/80">
                  Preserve your manual mappings and approved/rejected statuses. Only unreviewed matches will be overwritten.
                </p>
              </div>
            </button>

            <button
              onClick={() => onRestart(false)}
              className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-500/50 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all flex items-start space-x-4 group"
            >
              <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-red-100 group-hover:text-red-500 dark:group-hover:bg-red-500/20 dark:group-hover:text-red-400 rounded-lg transition-colors">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-red-700 dark:group-hover:text-red-300 mb-1">Clear All (Fresh Start)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-red-600/80 dark:group-hover:text-red-300/80">
                  Wipe all manual overrides and generate a completely fresh set of mappings.
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
