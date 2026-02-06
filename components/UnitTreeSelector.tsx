import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Folder, BookOpen, CheckSquare, Square } from 'lucide-react';

interface Folder {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
  folderId?: string;
}

interface UnitTreeSelectorProps {
  folders: Folder[];
  units: Unit[];
  selectedUnitIds: string[];
  onChange: (unitIds: string[]) => void;
  label?: string;
}

const UnitTreeSelector: React.FC<UnitTreeSelectorProps> = ({
  folders,
  units,
  selectedUnitIds,
  onChange,
  label = '选择单元'
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Group units by folder
  const unitsByFolder = useMemo(() => {
    const map = new Map<string, Unit[]>();
    
    // Initialize with folders
    folders.forEach(folder => {
      map.set(folder.id, []);
    });
    
    // Add uncategorized folder
    map.set('uncategorized', []);
    
    // Distribute units
    units.forEach(unit => {
      const folderId = unit.folderId || 'uncategorized';
      if (!map.has(folderId)) {
        map.set(folderId, []);
      }
      map.get(folderId)!.push(unit);
    });
    
    return map;
  }, [folders, units]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const toggleUnit = (unitId: string) => {
    const newIds = selectedUnitIds.includes(unitId)
      ? selectedUnitIds.filter(id => id !== unitId)
      : [...selectedUnitIds, unitId];
    onChange(newIds);
  };

  const toggleFolder批量 = (folderId: string) => {
    const folderUnits = unitsByFolder.get(folderId) || [];
    const folderUnitIds = folderUnits.map(u => u.id);
    const allSelected = folderUnitIds.every(id => selectedUnitIds.includes(id));
    
    if (allSelected) {
      // Deselect all units in this folder
      onChange(selectedUnitIds.filter(id => !folderUnitIds.includes(id)));
    } else {
      // Select all units in this folder
      const newIds = Array.from(new Set([...selectedUnitIds, ...folderUnitIds]));
      onChange(newIds);
    }
  };

  const getFolderName = (folderId: string) => {
    if (folderId === 'uncategorized') return '未分类';
    return folders.find(f => f.id === folderId)?.name || '未知文件夹';
  };

  const renderFolder = (folderId: string) => {
    const folderUnits = unitsByFolder.get(folderId) || [];
    if (folderUnits.length === 0) return null;
    
    const isExpanded = expandedFolders.has(folderId);
    const allSelected = folderUnits.every(u => selectedUnitIds.includes(u.id));
    const someSelected = folderUnits.some(u => selectedUnitIds.includes(u.id)) && !allSelected;

    return (
      <div key={folderId} className="mb-2">
        <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer group">
          <button
            onClick={() => toggleFolder(folderId)}
            className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
          
          <button
            onClick={() => toggleFolder批量(folderId)}
            className="flex items-center gap-2 flex-1 min-w-0"
          >
            <div className="relative">
              {allSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              ) : someSelected ? (
                <div className="w-3.5 h-3.5 border-2 border-blue-600 dark:border-blue-400 rounded flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-sm" />
                </div>
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-300" />
              )}
            </div>
            
            <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
              {getFolderName(folderId)}
            </span>
            <span className="text-[10px] text-slate-400 ml-auto">
              ({folderUnits.length})
            </span>
          </button>
        </div>
        
        {isExpanded && (
          <div className="ml-7 mt-1 space-y-0.5">
            {folderUnits.map(unit => {
              const isSelected = selectedUnitIds.includes(unit.id);
              return (
                <div
                  key={unit.id}
                  onClick={() => toggleUnit(unit.id)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                  )}
                  <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs truncate">{unit.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center justify-between mb-2 px-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {label}
          </label>
          {selectedUnitIds.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
            >
              清除
            </button>
          )}
        </div>
      )}
      
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 max-h-60 overflow-y-auto p-1">
        {Array.from(unitsByFolder.keys()).map(folderId => renderFolder(folderId))}
      </div>
      
      {selectedUnitIds.length > 0 && (
        <div className="text-[10px] text-slate-500 dark:text-slate-400 px-1 mt-1">
          已选择 {selectedUnitIds.length} 个单元
        </div>
      )}
    </div>
  );
};

export default UnitTreeSelector;
