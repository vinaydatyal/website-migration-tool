import React from 'react';
import { CheckCircle2, Circle, Info, Settings, Save, AlertCircle } from 'lucide-react';
import { MIGRATION_CHECKLISTS } from '../data/checklists';
import { MigrationProject, ProjectMetadata } from '../types/migration';

interface MigrationChecklistProps {
  project: MigrationProject;
  onUpdateProgress: (progress: Record<string, boolean>) => void;
  onUpdateMetadata: (metadata: Partial<ProjectMetadata>) => void;
}

export const MigrationChecklist: React.FC<MigrationChecklistProps> = ({ project, onUpdateProgress, onUpdateMetadata }) => {
  const profileKey = project.profile === 'UNKNOWN' ? 'CMS_SWITCH' : project.profile;
  const playbook = MIGRATION_CHECKLISTS[profileKey];
  
  const checklistProgress = project.checklistProgress || {};
  const metadata = project.metadata || {};

  const toggleItem = (id: string) => {
    const newProgress = { ...checklistProgress, [id]: !checklistProgress[id] };
    onUpdateProgress(newProgress);
  };

  const handleMetadataChange = (key: keyof ProjectMetadata, value: string | number) => {
    onUpdateMetadata({ [key]: value });
  };

  const calculateProgress = () => {
    if (!playbook) return 0;
    const totalItems = playbook.phases.reduce((acc, phase) => acc + phase.items.length, 0);
    const completedItems = playbook.phases.reduce((acc, phase) => {
      return acc + phase.items.filter(item => checklistProgress[item.id]).length;
    }, 0);
    return Math.round((completedItems / totalItems) * 100);
  };

  if (!playbook) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Info className="h-10 w-10 mb-4 opacity-50" />
        <p>No checklist available for this migration profile.</p>
      </div>
    );
  }

  const progressPercent = calculateProgress();

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">{playbook.title}</h2>
        <p className="text-slate-400 text-sm mb-6">{playbook.description}</p>
        
        {/* Progress Bar */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-300">Playbook Progress</span>
            <span className="text-sm font-bold text-brand-400">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-brand-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Integration Hub / Metadata */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden mb-8">
          <div className="bg-slate-800/40 px-6 py-4 border-b border-slate-700/50 flex items-center gap-3">
            <Settings className="h-5 w-5 text-brand-500" />
            <h3 className="text-lg font-bold text-white">Migration Integration Hub</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Google Search Console Property</label>
                <input 
                  type="text" 
                  placeholder="e.g. https://www.client.com/"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
                  value={metadata.gscPropertyUrl || ''}
                  onChange={(e) => handleMetadataChange('gscPropertyUrl', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">GA4 Measurement ID</label>
                <input 
                  type="text" 
                  placeholder="e.g. G-XXXXXXXXXX"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
                  value={metadata.ga4MeasurementId || ''}
                  onChange={(e) => handleMetadataChange('ga4MeasurementId', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">SEMrush Project ID</label>
                <input 
                  type="text" 
                  placeholder="e.g. 1234567"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
                  value={metadata.semrushProjectId || ''}
                  onChange={(e) => handleMetadataChange('semrushProjectId', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Baseline Indexed Pages</label>
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
                  value={metadata.baselineIndexedPages || ''}
                  onChange={(e) => handleMetadataChange('baselineIndexedPages', parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Baseline Organic Clicks (30d)</label>
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
                  value={metadata.baselineOrganicClicks || ''}
                  onChange={(e) => handleMetadataChange('baselineOrganicClicks', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="bg-brand-500/10 border border-brand-500/20 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
                <p className="text-xs text-brand-300/80 leading-relaxed">
                  These baselines are saved locally in your browser. Record them before the staging cutover so you have a point of truth to measure against post-launch.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Phases */}
        <div className="space-y-8">
          {playbook.phases.map((phase, phaseIdx) => (
            <div key={phaseIdx} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700/50">
                <h3 className="text-lg font-bold text-white">{phase.title}</h3>
              </div>
              <div className="divide-y divide-slate-800/60">
                {phase.items.map(item => {
                  const isChecked = !!checklistProgress[item.id];
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`w-full flex items-start text-left px-6 py-4 transition-colors hover:bg-slate-800/30 group ${
                        isChecked ? 'bg-emerald-500/5' : ''
                      }`}
                    >
                      <div className="mt-0.5 shrink-0 mr-4">
                        {isChecked ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-slate-600 group-hover:text-emerald-500/50 transition-colors" />
                        )}
                      </div>
                      <span className={`text-sm leading-relaxed ${isChecked ? 'text-slate-400 line-through opacity-70' : 'text-slate-200'}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

