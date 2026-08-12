import React from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

export interface FilterCondition {
  id: string;
  operator: 'CONTAINS' | 'EQUALS' | 'NOT_CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH';
  value: string;
}

interface FilterBuilderProps {
  conditions: FilterCondition[];
  onAddCondition: () => void;
  onUpdateCondition: (id: string, updates: Partial<FilterCondition>) => void;
  onRemoveCondition: (id: string) => void;
}

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  conditions,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition
}) => {
  return (
    <div className="flex flex-col gap-2 w-full">
      {conditions.map((cond, index) => (
        <div key={cond.id} className="flex items-center gap-2">
          {index > 0 && (
            <div className="text-[10px] font-bold text-slate-500 uppercase px-1 shrink-0">AND</div>
          )}
          <div className="relative flex items-center flex-1">
            <div className="relative z-10 flex-shrink-0">
              <select
                value={cond.operator}
                onChange={(e) => onUpdateCondition(cond.id, { operator: e.target.value as any })}
                className="appearance-none bg-slate-900 border border-slate-800 border-r-0 rounded-l-xl text-xs font-semibold text-slate-300 py-[9px] pl-3 pr-7 focus:outline-none focus:border-brand-500/50 hover:bg-slate-800 cursor-pointer h-full"
              >
                <option value="CONTAINS">Contains</option>
                <option value="EQUALS">Equal to</option>
                <option value="NOT_CONTAINS">Does not contain</option>
                <option value="STARTS_WITH">Starts with</option>
                <option value="ENDS_WITH">Ends with</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
            </div>
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search URLs, titles, or properties..."
                value={cond.value}
                onChange={(e) => onUpdateCondition(cond.id, { value: e.target.value })}
                className={`w-full pl-10 pr-4 py-2 ${(index === 0 && conditions.length === 1) || (!cond.id) ? 'rounded-r-xl' : 'rounded-none'} bg-slate-950/70 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-500/50 border-l-0`}
                style={{ borderRightWidth: (index > 0 || conditions.length > 1) ? '0' : undefined }}
              />
            </div>
            {(index > 0 || conditions.length > 1) && (
              <button
                onClick={() => onRemoveCondition(cond.id)}
                className="flex items-center justify-center bg-slate-900 border border-slate-800 border-l-0 rounded-r-xl h-full px-3 text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                style={{ paddingBottom: '9px', paddingTop: '9px' }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}
      <div className="flex justify-start pl-2">
        <button
          onClick={onAddCondition}
          className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center space-x-1"
        >
          <span className="text-lg leading-none mb-0.5">+</span>
          <span>Add Filter Condition</span>
        </button>
      </div>
    </div>
  );
};
