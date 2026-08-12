import React from 'react';
import { UrlMapping, CrawlEntry } from '../types/migration';
import { CheckCircle2, Ban, Check, X, Copy } from 'lucide-react';

interface Props {
  m: UrlMapping;
  isEditing: boolean;
  targetEntries: CrawlEntry[];
  onApprove: (id: string) => void;
  onSet410: (id: string) => void;
  onSaveCustomTarget: (id: string, newTarget: string) => void;
  onCancelEdit: () => void;
  onSelectTarget: (id: string, targetId: string) => void;
  onStartEdit: (id: string) => void;
  onShowDuplicates: () => void;
  targetCount: number;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

export const UrlMappingTableRow = React.memo(({
  m,
  isEditing,
  targetEntries,
  onApprove,
  onSet410,
  onSaveCustomTarget,
  onCancelEdit,
  onSelectTarget,
  onStartEdit,
  onShowDuplicates,
  targetCount,
  isSelected,
  onToggleSelect
}: Props) => {
  const [customTargetInput, setCustomTargetInput] = React.useState('');

  React.useEffect(() => {
    if (isEditing) {
      setCustomTargetInput(m.targetUrl);
    }
  }, [isEditing, m.targetUrl]);

  const q = customTargetInput.toLowerCase();
  const suggestedTargets = isEditing && q.length > 1 
    ? targetEntries.filter(t => 
        t.normalizedPath.toLowerCase().includes(q) || 
        (t.title?.toLowerCase().includes(q))
      ).slice(0, 15)
    : [];

  return (
    <div 
      className={`flex items-start w-full border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
        m.status === 'GONE_410' ? 'opacity-60 bg-slate-100 dark:bg-slate-950/40' : ''
      }`}
    >
      {/* Checkbox Column */}
      <div className="py-4 pl-4 pr-2 shrink-0 flex items-center justify-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(m.id)}
          className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-brand-500 focus:ring-brand-500/50 focus:ring-offset-0 cursor-pointer"
        />
      </div>

      {/* Source URL Column */}
      <div className="py-4 px-3 w-[35%] space-y-1.5 shrink-0">
        <div className="flex items-center space-x-2">
          <span className="font-mono font-bold text-slate-800 dark:text-slate-100 break-all text-xs">
            {m.source.normalizedPath}
          </span>
          <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            {m.source.inlinks} inlinks
          </span>
        </div>
        {m.source.title && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
            {m.source.title}
          </div>
        )}
        <div className="text-[10px] text-slate-500 font-mono truncate">
          {m.source.url}
        </div>
      </div>

      {/* Target URL Column */}
      <div className="py-4 px-4 w-[35%] space-y-1.5 shrink-0">
        {isEditing ? (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={customTargetInput}
                onChange={(e) => setCustomTargetInput(e.target.value)}
                placeholder="Start typing to search target pages..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-brand-500/60 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400/50 shadow-sm"
              />
              <button
                onClick={() => onSaveCustomTarget(m.id, customTargetInput)}
                className="p-1.5 rounded-lg bg-brand-500 text-white dark:text-slate-950 hover:bg-brand-600 dark:hover:bg-brand-400 font-bold transition-colors"
                title="Save Custom Target"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={onCancelEdit}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Autocomplete Suggestions Box */}
            {suggestedTargets.length > 0 && (
              <div className="mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg max-h-48 overflow-y-auto shadow-lg dark:shadow-inner">
                {suggestedTargets.map(t => (
                  <div
                    key={t.id}
                    onClick={() => onSelectTarget(m.id, t.id)}
                    className="px-3 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-brand-50 dark:hover:bg-brand-500/10 cursor-pointer transition-colors"
                  >
                    <div className="font-mono text-emerald-600 dark:text-emerald-300 font-bold text-[11px]">{t.normalizedPath}</div>
                    {t.title && <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{t.title}</div>}
                  </div>
                ))}
              </div>
            )}
            {q.length > 1 && suggestedTargets.length === 0 && (
              <div className="mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-500">
                No crawled pages found matching "{customTargetInput}". You can still save it as a custom path.
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between group">
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className={`font-mono font-bold break-all text-xs ${
                    m.status === 'GONE_410' 
                      ? 'text-slate-400 dark:text-slate-500 line-through' 
                      : (m.target ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-400')
                  }`}>
                    {m.status === 'GONE_410' ? '410 GONE (Removed)' : (m.target ? m.target.normalizedPath : m.targetUrl)}
                  </span>
                  {m.target && m.target.statusCode >= 400 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/40">
                      HTTP {m.target.statusCode}
                    </span>
                  )}
                </div>
                
                {m.target?.title && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">
                    {m.target.title}
                  </div>
                )}
                
                {targetCount > 1 && m.status !== 'GONE_410' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowDuplicates();
                    }}
                    className="mt-1.5 flex items-center space-x-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 border border-amber-200 dark:border-amber-500/20 hover:border-amber-300 dark:hover:border-amber-500/40 rounded-md px-1.5 py-0.5 w-max transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Mapped to {targetCount} source URLs</span>
                  </button>
                )}
              </div>
              
              <button
                onClick={() => onStartEdit(m.id)}
                className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 underline decoration-slate-300 dark:decoration-slate-600 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0"
              >
                Override
              </button>
            </div>

            {/* Parity Warnings pill */}
            {m.discrepancies.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {m.discrepancies.map((d) => (
                  <span 
                    key={d.id}
                    title={`${d.description}\n\nSource: ${d.sourceValue}\nTarget: ${d.targetValue}\n\nRecommendation: ${d.recommendation}`}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-medium cursor-help ${
                      d.severity === 'CRITICAL' 
                        ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30' 
                        : d.severity === 'HIGH'
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent'
                    }`}
                  >
                    {d.title}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="py-4 px-4 w-32 shrink-0 flex flex-col items-start space-y-1">
        {(m.source.visits !== undefined && m.source.visits > 0) ? (
          <div className="text-[11px] text-slate-700 dark:text-slate-300 font-mono flex items-center justify-between w-full">
            <span className="text-slate-500">Visits:</span>
            <span className="font-bold">{m.source.visits.toLocaleString()}</span>
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 dark:text-slate-600 font-mono">No data</div>
        )}
        
        {(m.source.revenue !== undefined && m.source.revenue > 0) && (
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center justify-between w-full">
            <span className="text-emerald-500/70">Rev:</span>
            <span className="font-bold">${m.source.revenue.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Confidence Column */}
      <div className="py-4 px-4 w-24 shrink-0 flex flex-col items-center">
        <div className="inline-flex flex-col items-center space-y-1">
          <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
            m.confidenceScore >= 90
              ? 'bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30'
              : m.confidenceScore >= 70
              ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30'
              : m.confidenceScore >= 50
              ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
              : 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30'
          }`}>
            {m.confidenceScore}%
          </span>
          <span className="text-[9px] text-slate-500 uppercase font-semibold">
            {m.strategy.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Actions Column */}
      <div className="py-4 px-4 w-28 shrink-0 flex justify-end space-x-1">
        {m.status !== 'APPROVED' && m.status !== 'GONE_410' && (
          <button
            onClick={() => onApprove(m.id)}
            className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-all cursor-pointer"
            title="Approve 301 Redirect"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        )}

        {m.status !== 'GONE_410' && (
          <button
            onClick={() => onSet410(m.id)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all cursor-pointer"
            title="Set as 410 Gone (Removed/Discontinued)"
          >
            <Ban className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
});
