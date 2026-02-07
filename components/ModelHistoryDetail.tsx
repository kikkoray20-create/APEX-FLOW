import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    ArrowLeft, RefreshCw, Calendar, Loader2, Clock, ChevronRight, TrendingUp, PackageSearch, User, X, Database, Users, MinusCircle
} from 'lucide-react';
import { InventoryLog } from '../types';
import { fetchInventoryLogs } from '../services/db';

interface ModelHistoryDetailProps {
    model: any;
    onBack: () => void;
}

interface ActivityDetail {
    name: string;
    qty: number;
}

interface GroupedActivity {
    id: string;
    date: string; // DD/MM/YYYY
    type: 'sold' | 'added' | 'deduct';
    totalQty: number;
    remainingStock: number;
    details: ActivityDetail[];
}

const ModelHistoryDetail: React.FC<ModelHistoryDetailProps> = ({ model, onBack }) => {
    const [logs, setLogs] = useState<InventoryLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // UI State for Detail Popup
    const [selectedGroupDetail, setSelectedGroupDetail] = useState<GroupedActivity | null>(null);

    // Helpers to handle DD/MM/YYYY formatting for display
    const fromISODate = (iso: string) => {
        if (!iso || typeof iso !== 'string') return '';
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    };

    const toISODate = (display: string) => {
        if (!display || typeof display !== 'string') return '';
        const parts = display.split('/');
        if (parts.length !== 3) return '';
        const [d, m, y] = parts;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    };

    // Date range states in ISO format for easy internal comparison
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    });

    // Hidden native picker refs
    const startPickerRef = useRef<HTMLInputElement>(null);
    const endPickerRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (model?.id) loadLogs();
    }, [model?.id]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await fetchInventoryLogs();
            if (!data) {
                setLogs([]);
                setLoading(false);
                return;
            }
            
            const brandMatch = (model?.brand || '').toLowerCase().trim();
            const modelMatch = (model?.model || '').toLowerCase().trim();
            const qualityMatch = (model?.quality || '').toLowerCase().trim();
            
            const filtered = data.filter(log => {
                if (!log) return false;
                // Prefer ID match, fallback to Name/Brand match for reliability
                const isIdMatch = log.itemId && String(log.itemId) === String(model.id);
                const logName = (log.modelName || '').toLowerCase();
                const isNameMatch = brandMatch && modelMatch && 
                                  logName.includes(brandMatch) && 
                                  logName.includes(modelMatch) && 
                                  (qualityMatch === '' || logName.includes(qualityMatch));
                
                return isIdMatch || isNameMatch;
            });

            setLogs(filtered);
        } catch (error) {
            console.error("Log fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const parseDateTime = (dateStr: string) => {
        if (!dateStr || typeof dateStr !== 'string') return 0;
        try {
            const parts = dateStr.replace(',', '').split(' ');
            const datePart = parts[0];
            if (!datePart) return 0;
            const dateParts = datePart.split('/');
            if (dateParts.length !== 3) return 0;
            const [d, m, y] = dateParts.map(Number);
            let hours = 0, minutes = 0;
            if (parts[1]) {
                const timeParts = parts[1].split(':');
                if (timeParts.length >= 2) {
                    hours = parseInt(timeParts[0]);
                    minutes = parseInt(timeParts[1]);
                    if (parts[2] === 'PM' && hours < 12) hours += 12;
                    if (parts[2] === 'AM' && hours === 12) hours = 0;
                }
            }
            const date = new Date(y, m - 1, d, hours, minutes);
            return isNaN(date.getTime()) ? 0 : date.getTime();
        } catch (e) { return 0; }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadLogs();
        setIsRefreshing(false);
    };

    // LOGIC: Group logs by Date and Type (Sold, Added, Deduct)
    const groupedActivities = useMemo(() => {
        const groups: Record<string, GroupedActivity> = {};
        if (!logs) return [];

        const sortedRaw = [...logs].sort((a, b) => parseDateTime(b.createdDate) - parseDateTime(a.createdDate));

        sortedRaw.forEach(log => {
            if (!log || !log.createdDate) return;
            
            try {
                const parts = log.createdDate.replace(',', '').split(' ');
                const dateOnly = parts[0]; // DD/MM/YYYY
                const dateParts = dateOnly.split('/');
                if (dateParts.length !== 3) return;

                const [d, m, y] = dateParts;
                const compareDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

                if (compareDate < startDate || compareDate > endDate) return;

                const logIdStr = String(log.id || '');
                const remarks = (log.remarks || '').toLowerCase();
                let type: 'sold' | 'added' | 'deduct' = 'sold';
                
                if (log.status === 'Added') {
                    type = 'added';
                } else if (log.status === 'Removed') {
                    // Logic: Predictable IDs starting with 'sale-' are considered sales
                    // This ensures that when we delete 'sale-' logs on reject, the history is cleared
                    if (logIdStr.startsWith('sale-') || remarks.includes('order')) {
                        type = 'sold';
                    } else {
                        type = 'deduct';
                    }
                }

                const groupKey = `${dateOnly}_${type}`;
                const qty = log.quantityChange || log.totalQuantity || 0;
                const nodeName = log.shopName || log.customerName || 'Manual Entry';

                if (!groups[groupKey]) {
                    groups[groupKey] = {
                        id: groupKey,
                        date: dateOnly,
                        type: type,
                        totalQty: 0,
                        remainingStock: log.currentStock ?? 0,
                        details: []
                    };
                }

                groups[groupKey].totalQty += qty;
                
                const existingDetail = groups[groupKey].details.find(d => d.name === nodeName);
                if (existingDetail) {
                    existingDetail.qty += qty;
                } else {
                    groups[groupKey].details.push({
                        name: nodeName,
                        qty: qty
                    });
                }
                
                // Track remaining stock based on most recent log for this day/type
                groups[groupKey].remainingStock = log.currentStock ?? groups[groupKey].remainingStock;
            } catch (e) { /* Skip malformed logs */ }
        });

        return Object.values(groups).sort((a, b) => {
            const aParts = a.date.split('/');
            const bParts = b.date.split('/');
            if (aParts.length !== 3 || bParts.length !== 3) return 0;
            const da = new Date(Number(aParts[2]), Number(aParts[1]) - 1, Number(aParts[0])).getTime();
            const db = new Date(Number(bParts[2]), Number(bParts[1]) - 1, Number(bParts[0])).getTime();
            return db - da;
        });
    }, [logs, startDate, endDate]);

    return (
        <div className="flex flex-col space-y-8 animate-in fade-in duration-500 pb-16">
            
            {/* --- TOP HEADER --- */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 px-1 no-print">
                <div className="flex items-center gap-5 w-full lg:w-auto">
                    <button 
                        onClick={onBack}
                        className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl hover:bg-slate-800 transition-all active:scale-90 shrink-0"
                    >
                        <ArrowLeft size={28} strokeWidth={2.5} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Catalog History</h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">{model?.brand}</span>
                            <ChevronRight size={12} className="text-slate-300" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{model?.model}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                    <div className="flex items-center gap-4 bg-white border border-slate-200 px-8 py-3.5 rounded-3xl shadow-sm">
                        <div className="w-8 h-8 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
                            <TrendingUp size={16} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Base Rate</p>
                            <p className="text-xl font-black text-slate-800 tracking-tighter leading-none">₹{Number(model?.price || 0).toFixed(1)}</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-4 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-indigo-600 shadow-sm transition-all active:rotate-180 duration-700"
                    >
                        <RefreshCw size={20} strokeWidth={2.5} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* --- FILTERS --- */}
            <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-6 items-center no-print">
                <div className="flex items-center gap-4 flex-1 w-full group">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                        <Calendar size={20} />
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
                        {/* Start Date Display Input */}
                        <div className="space-y-1 w-full relative">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Period Start</label>
                            <div className="relative group/picker">
                                <input 
                                    type="text" 
                                    readOnly
                                    value={fromISODate(startDate)} 
                                    onClick={() => startPickerRef.current?.showPicker()}
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold text-slate-700 outline-none hover:border-indigo-300 transition-all shadow-inner cursor-pointer"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-hover/picker:text-indigo-400 transition-colors pointer-events-none">
                                    <Calendar size={14} />
                                </div>
                                <input 
                                    type="date"
                                    ref={startPickerRef}
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="absolute inset-0 opacity-0 pointer-events-none"
                                />
                            </div>
                        </div>

                        <div className="text-slate-200 hidden sm:block">
                            <ChevronRight size={20} />
                        </div>

                        {/* End Date Display Input */}
                        <div className="space-y-1 w-full relative">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Period End</label>
                            <div className="relative group/picker">
                                <input 
                                    type="text" 
                                    readOnly
                                    value={fromISODate(endDate)} 
                                    onClick={() => endPickerRef.current?.showPicker()}
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold text-slate-700 outline-none hover:border-indigo-300 transition-all shadow-inner cursor-pointer"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-hover/picker:text-indigo-400 transition-colors pointer-events-none">
                                    <Calendar size={14} />
                                </div>
                                <input 
                                    type="date"
                                    ref={endPickerRef}
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="absolute inset-0 opacity-0 pointer-events-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="hidden xl:block h-12 w-px bg-slate-100 mx-2"></div>
                <div className="flex items-center gap-4 bg-indigo-50 px-8 py-5 rounded-[2rem] border border-indigo-100 shrink-0 w-full xl:w-auto">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                        <PackageSearch size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Store Inventory</p>
                        <p className="text-xl font-black text-indigo-600 tracking-tighter leading-none">{Number(model?.quantity || 0)} Units</p>
                    </div>
                </div>
            </div>

            {/* --- DATA TABLE --- */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col">
                <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Chronological Activity Log</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Audit Trail Node</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Ready</span>
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left table-fixed min-w-[1000px]">
                        <thead>
                            <tr className="bg-white border-b border-slate-50">
                                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 w-[20%]">History Date</th>
                                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center w-[15%]">Sale Count</th>
                                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center w-[15%]">Inventory</th>
                                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center w-[15%]">Status</th>
                                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-[35%]">Remaining Inventory</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={5} className="py-40 text-center"><Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} /><p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mt-4">Syncing encrypted history...</p></td></tr>
                            ) : groupedActivities.length === 0 ? (
                                <tr><td colSpan={5} className="py-40 text-center"><Database size={48} className="text-slate-100 mx-auto mb-4" /><p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">No activity detected in this time node</p></td></tr>
                            ) : groupedActivities.map((group) => (
                                <tr key={group.id} className="hover:bg-slate-50/80 transition-all group">
                                    <td className="px-10 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-indigo-500 transition-colors">
                                                <Clock size={14} />
                                            </div>
                                            <span className="text-[13px] font-bold text-slate-600 uppercase tracking-tight">{group.date}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        {group.type === 'sold' ? (
                                            <button 
                                                onClick={() => setSelectedGroupDetail(group)}
                                                className="px-6 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-lg font-black tracking-tighter hover:bg-blue-100 transition-all shadow-sm border border-blue-100"
                                            >
                                                {group.totalQty}
                                            </button>
                                        ) : (
                                            <span className="text-lg font-black tracking-tighter text-slate-200">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        {group.type === 'added' ? (
                                            <span className="text-[15px] font-black tracking-widest text-emerald-500">+{group.totalQty}</span>
                                        ) : group.type === 'deduct' ? (
                                            <span className="text-[15px] font-black tracking-widest text-rose-500">-{group.totalQty}</span>
                                        ) : (
                                            <span className="text-lg font-black tracking-tighter text-slate-200">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        <span className={`inline-flex px-4 py-1.5 rounded-xl text-[9px] font-black border uppercase tracking-[0.15em] shadow-sm ${
                                            group.type === 'sold' 
                                            ? 'bg-blue-50 text-blue-600 border-blue-100' 
                                            : group.type === 'added'
                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                            : 'bg-rose-50 text-rose-600 border-rose-100'
                                        }`}>
                                            {group.type === 'sold' ? 'sold' : group.type === 'added' ? 'Added' : 'Deduct'}
                                        </span>
                                    </td>
                                    <td className="px-10 py-6 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <span className={`inline-block px-4 py-1.5 rounded-xl text-[13px] font-black tracking-tighter border ${
                                                group.remainingStock > 0 
                                                ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200' 
                                                : 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-100'
                                            }`}>
                                                {group.remainingStock} units
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- DETAIL POPUP --- */}
            {selectedGroupDetail && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg text-white ${selectedGroupDetail.type === 'sold' ? 'bg-blue-600' : selectedGroupDetail.type === 'added' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                                    {selectedGroupDetail.type === 'sold' ? <Users size={20} /> : selectedGroupDetail.type === 'added' ? <Database size={20}/> : <MinusCircle size={20}/>}
                                </div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                    {selectedGroupDetail.type === 'sold' ? 'Customer Dispatch Batch' : selectedGroupDetail.type === 'added' ? 'Stock Entry Detail' : 'Manual Deduction Detail'}
                                </h3>
                            </div>
                            <button onClick={() => setSelectedGroupDetail(null)} className="text-slate-400 hover:text-rose-500 transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="flex flex-col max-h-[60vh]">
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Recipient Breakdown</p>
                                {selectedGroupDetail.details.map((detail, idx) => (
                                    <div key={idx} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:border-indigo-200 transition-all shadow-sm">
                                        <div className="min-w-0 flex-1 pr-4">
                                            <div className="flex items-center gap-2">
                                                <User size={12} className="text-indigo-400" />
                                                <p className="text-[13px] font-black text-slate-900 uppercase tracking-tight truncate">{detail.name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={`text-[16px] font-black tracking-tighter ${selectedGroupDetail.type === 'added' ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                {selectedGroupDetail.type === 'added' ? `+${detail.qty}` : `-${detail.qty}`} PCS
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="px-8 py-6 border-t border-slate-100 flex justify-center bg-slate-50/30">
                            <button 
                                onClick={() => setSelectedGroupDetail(null)}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all active:scale-95"
                            >
                                Close Audit View
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModelHistoryDetail;