import React from 'react';
import { UrlMapping, CrawlEntry } from '../types/migration';
import { CheckCircle2, Ban, Check, X, Copy, Loader2, Zap, Eye, EyeOff, Edit2, ExternalLink } from 'lucide-react';

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
  onToggleHide: (id: string, hide: boolean) => void;
  onSaveNotes?: (id: string, notes: string) => void;
  onUpdateMapping?: (id: string, updates: Partial<UrlMapping>) => void;
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
  onToggleSelect,
  onToggleHide,
  onSaveNotes,
  onUpdateMapping
}: Props) => {
  const [customTargetInput, setCustomTargetInput] = React.useState('');
  const [pingStatus, setPingStatus] = React.useState<number | null>(null);
  const [isPinging, setIsPinging] = React.useState(false);
  const [localNotes, setLocalNotes] = React.useState(m.notes || '');

  React.useEffect(() => {
    setLocalNotes(m.notes || '');
  }, [m.notes]);

  const handlePing = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const urlToPing = m.target?.url || m.targetUrl;
    if (!urlToPing || m.status === 'GONE_410') return;
    setIsPinging(true);
    try {
      const res = await fetch(`/api/ping-url?url=${encodeURIComponent(urlToPing)}`);
      const data = await res.json();
      setPingStatus(data.status);
    } catch (err) {
      setPingStatus(0);
    } finally {
      setIsPinging(false);
    }
  };

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
      className={`flex flex-col md:flex-row md:items-start w-full border-b border-slate-200 dark:border-slate-800/60 transition-colors py-3 md:py-0 relative ${
        m.status === 'GONE_410' ? 'opacity-60 bg-slate-100 dark:bg-slate-950/40' : targetCount > 1 && m.strategy !== 'UNMAPPED' ? 'bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-100/50 dark:hover:bg-amber-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
      }`}
    >
      {/* Checkbox Column */}
      <div className="absolute top-4 left-4 md:static md:py-4 md:pl-4 md:pr-2 shrink-0 flex items-center justify-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(m.id)}
          className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-brand-500 focus:ring-brand-500/50 focus:ring-offset-0 cursor-pointer"
        />
      </div>

      {/* Source URL Column */}
      <div className="pt-1 pb-2 pl-11 pr-4 md:py-4 md:px-3 w-full md:w-[35%] space-y-1.5 shrink-0">
        <div className="flex items-center space-x-2">
          <span className="font-mono font-bold text-slate-800 dark:text-slate-100 break-all text-xs">
            {m.source.normalizedPath}
          </span>
          <a 
            href={m.source.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-brand-500 transition-colors inline-flex shrink-0"
            title="Open Source URL"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
          <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
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
      <div className="pt-0 pb-2 pl-11 pr-4 md:py-4 md:px-4 w-full md:w-[35%] space-y-1.5 shrink-0">
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
                    className="group flex items-center justify-between px-3 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-brand-50 dark:hover:bg-brand-500/10 cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-mono text-emerald-600 dark:text-emerald-300 font-bold text-[11px] truncate">{t.normalizedPath}</div>
                      {t.title && <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{t.title}</div>}
                    </div>
                    {t.url && (
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-brand-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        title="Open Target URL"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
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
                  {pingStatus !== null && (
                    <span className={`px-1.5 py-0.2 text-[10px] font-mono rounded border ${
                      pingStatus >= 200 && pingStatus < 300 
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40' 
                        : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/40'
                    }`}>
                      {pingStatus === 0 ? 'FAIL' : `HTTP ${pingStatus}`}
                    </span>
                  )}
                  {m.status !== 'GONE_410' && (m.target?.url || m.targetUrl) && !isEditing && (
                    <div className="flex items-center space-x-1 shrink-0">
                      <button 
                        onClick={handlePing}
                        disabled={isPinging}
                        className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-brand-500 transition-colors"
                        title="Ping URL"
                      >
                        {isPinging ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                      </button>
                      <a 
                        href={m.target?.url || m.targetUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-brand-500 transition-colors inline-flex"
                        title="Open Target URL"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
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

            {/* Notes Field */}
            <div className="mt-2 group/note relative">
              <input
                type="text"
                placeholder="Add a note..."
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                onBlur={() => {
                  if (localNotes !== (m.notes || '')) {
                    onUpdateMapping?.(m.id, { notes: localNotes });
                  }
                }}
                className="w-full text-[10px] bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-brand-500 dark:focus:border-brand-500 outline-none px-0 py-0.5 text-slate-600 dark:text-slate-400 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
              />
            </div>
          </>
        )}
      </div>

      <div className="py-1 pl-11 pr-4 md:py-4 md:px-4 w-full md:w-32 shrink-0 flex flex-row md:flex-col items-center md:items-start space-x-4 md:space-x-0 md:space-y-1">
        {(m.source.visits !== undefined && m.source.visits > 0) ? (
          <div className="text-[11px] text-slate-700 dark:text-slate-300 font-mono flex items-center justify-between md:justify-end md:space-x-4 w-full">
            <span className="text-slate-500 md:hidden">Clicks:</span>
            <span className="font-bold md:text-right text-slate-600 dark:text-slate-400">{m.source.visits.toLocaleString()}</span>
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 dark:text-slate-600 font-mono">No data</div>
        )}
        
        {(m.source.revenue !== undefined && m.source.revenue > 0) && (
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center justify-between md:justify-end md:space-x-4 w-full mt-0.5">
            <span className="text-emerald-500/70 md:hidden">Impr:</span>
            <span className="font-bold md:text-right">{m.source.revenue.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Confidence Column */}
      <div className="py-1 pl-11 pr-4 md:py-4 md:px-4 w-full md:w-24 shrink-0 flex flex-row md:flex-col items-center md:items-center space-x-3 md:space-x-0">
        <div className="inline-flex flex-row md:flex-col items-center space-x-2 md:space-x-0 md:space-y-1">
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
      <div className="absolute top-3 right-3 md:static md:py-4 md:px-4 w-auto md:w-36 shrink-0 flex justify-end space-x-1">
        {m.status !== 'APPROVED' && m.status !== 'GONE_410' && (
          <button
            onClick={() => onApprove(m.id)}
            className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-all cursor-pointer"
            title="Approve 301 Redirect"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        )}

        {!isEditing && (
          <button
            onClick={() => onStartEdit(m.id)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-all cursor-pointer"
            title="Edit Target URL"
          >
            <Edit2 className="h-4 w-4" />
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

        {!isEditing && (
          <button
            onClick={() => onToggleHide(m.id, !m.isHidden)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all cursor-pointer"
            title={m.isHidden ? "Unhide" : "Hide"}
          >
            {m.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
});
