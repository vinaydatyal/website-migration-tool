import React from 'react';
import { CheckCircle2, AlertTriangle, ArrowRight, X } from 'lucide-react';

export interface DeltaReport {
  fixedCount: number;
  regressionCount: number;
  newMatchCount: number;
  totalPreserved: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  report: DeltaReport | null;
}

export const DeltaReportModal: React.FC<Props> = ({ isOpen, onClose, report }) => {
  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            Target Data Refreshed
          </h2>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Smart Merge Complete</h3>
            <p className="text-slate-600 dark:text-slate-400">
              Your manual approvals and notes were preserved across {report.totalPreserved} URLs. Here is what changed in the new crawl:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fixes */}
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-2">
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{report.fixedCount}</p>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Fixes</p>
                <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-1 leading-tight">Parity warnings resolved in this crawl.</p>
              </div>
            </div>

            {/* Regressions */}
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-2">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-red-700 dark:text-red-300">{report.regressionCount}</p>
                <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Regressions</p>
                <p className="text-[10px] text-red-600/70 dark:text-red-400/70 mt-1 leading-tight">New parity warnings or targets became 404.</p>
              </div>
            </div>
          </div>

          {report.newMatchCount > 0 && (
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{report.newMatchCount} New Matches</p>
                  <p className="text-xs text-blue-600/80 dark:text-blue-400/80">Previously unmapped URLs found a target.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};
