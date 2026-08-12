import React from 'react';
import { CheckCircle2, Circle, Info } from 'lucide-react';
import { MIGRATION_CHECKLISTS } from '../data/checklists';
import { MigrationProject } from '../types/migration';

interface MigrationChecklistProps {
  project: MigrationProject;
  onUpdateProgress: (progress: Record<string, boolean>) => void;
}

export const MigrationChecklist: React.FC<MigrationChecklistProps> = ({ project, onUpdateProgress }) => {
  // Use CMS_SWITCH as fallback if profile is UNKNOWN
  const profileKey = project.profile === 'UNKNOWN' ? 'CMS_SWITCH' : project.profile;
  const playbook = MIGRATION_CHECKLISTS[profileKey];
  
  const checklistProgress = project.checklistProgress || {};

  const toggleItem = (id: string) => {
    const newProgress = { ...checklistProgress, [id]: !checklistProgress[id] };
    onUpdateProgress(newProgress);
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

        {/* Phases */}
        <div className="space-y-8">
          {playbook.phases.map((phase, phaseIdx) => (
            <div key={phaseIdx} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
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
                        isChecked ? 'bg-brand-500/5' : ''
                      }`}
                    >
                      <div className="mt-0.5 shrink-0 mr-4">
                        {isChecked ? (
                          <CheckCircle2 className="h-5 w-5 text-brand-400" />
                        ) : (
                          <Circle className="h-5 w-5 text-slate-600 group-hover:text-brand-400/50 transition-colors" />
                        )}
                      </div>
                      <span className={`text-sm ${isChecked ? 'text-slate-300 line-through opacity-70' : 'text-slate-200'}`}>
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
