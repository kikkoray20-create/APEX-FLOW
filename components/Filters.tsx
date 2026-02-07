
import React from 'react';
import { Search, ChevronDown, RefreshCw } from 'lucide-react';

interface FiltersProps {
  searchTerm: string;
  setSearchTerm: (t: string) => void;
  dateFilter: string;
  setDateFilter: (d: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  modeFilter: string;
  setModeFilter: (m: string) => void;
  warehouseFilter: string;
  setWarehouseFilter: (w: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  isStaffView?: boolean;
  availableWarehouses?: string[];
}

const Filters: React.FC<FiltersProps> = ({ 
  searchTerm, 
  setSearchTerm,
  dateFilter,
  setDateFilter,
  statusFilter,
  setStatusFilter,
  modeFilter,
  setModeFilter,
  warehouseFilter,
  setWarehouseFilter,
  onRefresh,
  isRefreshing = false,
  isStaffView = false,
  availableWarehouses = []
}) => {
  const selectStyles = "appearance-none bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-[10px] font-black uppercase tracking-widest outline-none pr-10 w-full cursor-pointer hover:bg-slate-50 transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 shadow-sm";
  const iconStyles = "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none";

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-4 mb-8">
      {/* Search Input - Always Visible */}
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="SEARCH ORDERS BY CLIENT OR ID..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl text-[11px] font-bold uppercase tracking-tight outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder-slate-400"
        />
      </div>

      <div className={`flex flex-wrap items-center gap-3 ${isStaffView ? 'justify-end' : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:flex xl:flex-nowrap'}`}>
        {/* Advanced Filters - Hidden for Staff */}
        {!isStaffView && (
          <>
            {/* Date Filter */}
            <div className="relative min-w-[140px]">
              <select 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className={selectStyles}
              >
                <option value="ALL">ALL TIME</option>
                <option value="TODAY">TODAY</option>
                <option value="LAST 3 DAY">LAST 3 DAY</option>
                <option value="LAST 7 DAY">LAST 7 DAY</option>
                <option value="CURRENT MONTH">CURRENT MONTH</option>
                <option value="LAST MONTH">LAST MONTH</option>
              </select>
              <ChevronDown size={14} className={iconStyles} />
            </div>

            {/* Status Filter */}
            <div className="relative min-w-[140px]">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={selectStyles}
              >
                <option value="ALL STATUS">ALL STATUS</option>
                <option value="FRESH">FRESH</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="PACKED">PACKED</option>
                <option value="CHECKED">CHECKED</option>
                <option value="DISPATCHED">DISPATCHED</option>
                <option value="PENDING">PENDING</option>
                <option value="REJECTED">REJECTED</option>
              </select>
              <ChevronDown size={14} className={iconStyles} />
            </div>

            {/* Mode Filter */}
            <div className="relative min-w-[140px]">
              <select 
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                className={selectStyles}
              >
                <option value="ALL">ALL MODES</option>
                <option value="ONLINE">ONLINE</option>
                <option value="OFFLINE">OFFLINE</option>
                <option value="CASH">CASH</option>
              </select>
              <ChevronDown size={14} className={iconStyles} />
            </div>

            {/* Warehouse Filter */}
            <div className="relative min-w-[140px]">
              <select 
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className={selectStyles}
              >
                <option value="ALL">ALL WAREHOUSE</option>
                {availableWarehouses.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
              <ChevronDown size={14} className={iconStyles} />
            </div>
          </>
        )}

        {/* Refresh Button - Always Visible */}
        <button 
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 border border-indigo-500 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-70 whitespace-nowrap"
        >
          <RefreshCw size={14} strokeWidth={3} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  );
};

export default Filters;
