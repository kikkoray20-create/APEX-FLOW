
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Search, RefreshCw, Plus, Trash2, X, Check, Loader2, Info, 
    History, ChevronDown, ChevronLeft, ChevronRight, Eye, Package,
    AlertTriangle, ArrowRight, Database, ClipboardList, TrendingUp,
    LayoutGrid, List, Layers, MinusCircle, PlusCircle, ReceiptText,
    MessageSquare
} from 'lucide-react';
import { InventoryLog, InventoryItem, User } from '../types';
import { fetchInventoryLogs, fetchInventory, updateInventoryItemInDB, addInventoryLogToDB } from '../services/db';
import { useNotification } from '../context/NotificationContext';

const PAGE_SIZE_OPTIONS = [50, 100, 200, 300, 500, 1000];

interface StagedItem {
    item: InventoryItem;
    quantity: number;
}

interface InventoryProps {
    currentUser: User;
}

const Inventory: React.FC<InventoryProps> = ({ currentUser }) => {
    const [logs, setLogs] = useState<InventoryLog[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); 
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { showNotification } = useNotification();

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Bulk Modal States
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [transactionType, setTransactionType] = useState<'Add' | 'Remove'>('Add');
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal Input States
    const [modalSearch, setModalSearch] = useState('');
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [qtyInput, setQtyInput] = useState('');
    const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [showItemDropdown, setShowItemDropdown] = useState(false);

    // Detail Modal State
    const [viewingLog, setViewingLog] = useState<InventoryLog | null>(null);

    useEffect(() => { loadData(); }, [currentUser]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [loadedLogs, loadedInventory] = await Promise.all([ 
                fetchInventoryLogs(currentUser.instanceId), 
                fetchInventory(currentUser.instanceId) 
            ]);
            
            const manualOnlyLogs = (loadedLogs || []).filter(log => {
                const remarks = log.remarks || '';
                return !remarks.includes('Automatic Deduction') && 
                       !remarks.includes('Rejected Order Recovery') &&
                       !remarks.includes('Manual Edit Correction') &&
                       !remarks.includes('Bulk Fulfill Protocol');
            });
            
            setLogs(manualOnlyLogs);
            setInventory(loadedInventory || []);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => { 
        setIsRefreshing(true); 
        await loadData(); 
        setIsRefreshing(false); 
        showNotification('Manual audit records synchronized');
    };

    const openBulkModal = (type: 'Add' | 'Remove') => {
        setTransactionType(type);
        setStagedItems([]);
        setSelectedItem(null);
        setQtyInput('');
        setModalSearch('');
        setIsBulkModalOpen(true);
    };

    const handleAddToStage = () => {
        if (!selectedItem || !qtyInput) return;
        const qty = parseInt(qtyInput);
        if (isNaN(qty) || qty <= 0) {
            showNotification('Invalid quantity', 'error');
            return;
        }

        if (stagedItems.length >= 20) {
            showNotification('Limit reached: Maximum 20 models per transaction', 'error');
            return;
        }

        if (stagedItems.some(si => si.item.id === selectedItem.id)) {
            showNotification('Model already added to list', 'info');
            return;
        }

        setStagedItems([...stagedItems, { item: selectedItem, quantity: qty }]);
        setSelectedItem(null);
        setModalSearch('');
        setQtyInput('');
    };

    const handleRemoveFromStage = (id: string) => {
        setStagedItems(stagedItems.filter(si => si.item.id !== id));
    };

    const handleCommitTransaction = async () => {
        if (stagedItems.length === 0) return;
        setIsSaving(true);

        try {
            const now = new Date();
            const dateStr = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
            
            const batchItems = stagedItems.map(si => ({
                brand: si.item.brand,
                model: si.item.model,
                quality: si.item.quality,
                quantity: si.quantity,
                warehouse: si.item.warehouse || 'APEXFLOW'
            }));

            const totalQuantity = stagedItems.reduce((sum, si) => sum + si.quantity, 0);
            const primaryWarehouse = stagedItems[0]?.item.warehouse || 'Main Warehouse';

            for (const staged of stagedItems) {
                const item = staged.item;
                const change = staged.quantity;
                const newQty = transactionType === 'Add' ? (item.quantity || 0) + change : (item.quantity || 0) - change;
                await updateInventoryItemInDB({ ...item, quantity: newQty });

                await addInventoryLogToDB({
                  id: `ind-${Date.now()}-${item.id}`,
                  itemId: item.id,
                  modelName: `${item.brand} ${item.model} ${item.quality}`,
                  shopName: 'Manual Stock Update',
                  status: transactionType === 'Add' ? 'Added' : 'Removed',
                  quantityChange: change,
                  totalQuantity: change,
                  itemCount: 1,
                  currentStock: newQty,
                  remarks: `Manual Batch ${transactionType} Entry`,
                  createdDate: dateStr,
                  instanceId: currentUser.instanceId
                });
            }

            const summaryLog: InventoryLog = {
                id: `batch-${Date.now()}`,
                shopName: primaryWarehouse, 
                status: transactionType === 'Add' ? 'Added' : 'Removed',
                itemCount: stagedItems.length,
                totalQuantity: totalQuantity,
                items: batchItems,
                remarks: `Stock manual ${transactionType.toLowerCase()} via Architect Console`,
                createdDate: dateStr,
                instanceId: currentUser.instanceId
            };

            await addInventoryLogToDB(summaryLog);
            showNotification(`Processed ${stagedItems.length} models`, 'success');
            setIsBulkModalOpen(false);
            loadData();
        } catch (err) {
            console.error("Batch Transaction Failed", err);
            showNotification('Transaction failed', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredLogs = useMemo(() => {
        const searchLower = searchTerm.toLowerCase();
        return logs.filter(log => {
            if (log.remarks && log.remarks.includes('Manual Batch')) return false;
            if (log.remarks === 'Hidden individual entry for batch') return false;

            const matchesSearch = (log.remarks || '').toLowerCase().includes(searchLower) ||
                                (log.shopName || '').toLowerCase().includes(searchLower) ||
                                (log.items?.some(i => (i.model || '').toLowerCase().includes(searchLower)));
            
            const matchesStatus = statusFilter === 'ALL' || log.status === statusFilter;
            
            return matchesSearch && matchesStatus;
        });
    }, [logs, searchTerm, statusFilter]);

    const modalFilteredInventory = useMemo(() => {
        if (!modalSearch) return [];
        const searchLower = modalSearch.toLowerCase();
        return inventory.filter(i => 
            ((i.model || '').toLowerCase().includes(searchLower) || 
             (i.brand || '').toLowerCase().includes(searchLower)) &&
            !stagedItems.some(si => si.item.id === i.id)
        ).slice(0, 15);
    }, [inventory, modalSearch, stagedItems]);

    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
    const paginatedLogs = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredLogs, currentPage, itemsPerPage]);

    const rangeStart = filteredLogs.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const rangeEnd = Math.min(currentPage * itemsPerPage, filteredLogs.length);

    const selectStyles = "appearance-none bg-white border border-slate-200 rounded-[2rem] px-6 py-3.5 text-[10px] font-black uppercase tracking-widest outline-none pr-12 w-full cursor-pointer hover:bg-slate-50 transition-all focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 shadow-sm text-slate-600";
    const iconStyles = "absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none";

    return (
        <div className="flex flex-col space-y-8 animate-in fade-in duration-500 pb-16">
            
            {/* Redesigned Header Area */}
            <div className="flex flex-col xl:flex-row items-center justify-between gap-6 no-print">
                <div className="flex items-center gap-5 w-full xl:w-auto">
                    <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100 shrink-0">
                        <History size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">Stock Audits</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Manual Inventory Adjustments Log</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
                    <div className="flex items-center gap-4 bg-white border border-slate-200 px-6 py-3 rounded-2xl shadow-sm">
                        <div className="w-8 h-8 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
                            <Layers size={16} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Audit Nodes</p>
                            <p className="text-xl font-black text-slate-800 tracking-tighter leading-none">{logs.length}</p>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-slate-200 mx-2 hidden sm:block"></div>
                    <button onClick={() => openBulkModal('Add')} className="px-8 py-3.5 bg-indigo-600 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 active:scale-95 transition-all flex items-center gap-2">
                        <PlusCircle size={16} strokeWidth={4} /> Add Stock
                    </button>
                    <button onClick={() => openBulkModal('Remove')} className="px-8 py-3.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.2em] hover:bg-rose-600 hover:text-white transition-all active:scale-95 shadow-sm flex items-center gap-2">
                        <MinusCircle size={16} strokeWidth={4} /> Remove Stock
                    </button>
                </div>
            </div>

            {/* Filter Hub */}
            <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-4 items-center no-print">
                <div className="relative flex-1 group w-full">
                    <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Filter by remarks or shop..." 
                        value={searchTerm} 
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                        className="w-full pl-14 pr-8 py-4 bg-slate-50/50 border border-slate-200 rounded-[2rem] text-[13px] font-bold uppercase outline-none focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner" 
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    <div className="relative min-w-[200px]">
                        <select 
                            value={statusFilter} 
                            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} 
                            className={selectStyles}
                        >
                            <option value="ALL">All Audit Types</option>
                            <option value="Added">Stock Inflow</option>
                            <option value="Removed">Stock Outward</option>
                        </select>
                        <ChevronDown size={14} className={iconStyles} />
                    </div>
                    <button onClick={handleRefresh} disabled={isRefreshing} className="p-4 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-indigo-600 transition-all active:rotate-180 duration-700 shadow-sm">
                        <RefreshCw size={20} strokeWidth={2.5} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Main Data Table */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left table-fixed min-w-[1200px]">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="w-[18%] px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Target Node</th>
                                <th className="w-[10%] px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Movement</th>
                                <th className="w-[10%] px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Lines</th>
                                <th className="w-[10%] px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Net Qty</th>
                                <th className="w-[27%] px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Audit Remark</th>
                                <th className="w-[15%] px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Timestamp</th>
                                <th className="w-[10%] px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={7} className="py-40 text-center"><Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} /><p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mt-4">Syncing Encrypted Logs...</p></td></tr>
                            ) : paginatedLogs.length === 0 ? (
                                <tr><td colSpan={7} className="py-40 text-center"><History size={48} className="text-slate-100 mx-auto mb-4" /><p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">No audit records found in database</p></td></tr>
                            ) : paginatedLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-all group">
                                    <td className="px-8 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-[10px] shadow-sm shrink-0 uppercase">{log.shopName?.charAt(0) || 'A'}</div>
                                            <p className="text-[13px] font-black text-slate-800 uppercase truncate tracking-tight">{log.shopName}</p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-center">
                                        <span className={`inline-flex px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${log.status === 'Added' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                            {log.status === 'Added' ? 'Inflow' : 'Outward'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4 text-center">
                                        <button onClick={() => setViewingLog(log)} className="px-3 py-1 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm">
                                            {log.itemCount || (log.items ? log.items.length : 1)} Lines
                                        </button>
                                    </td>
                                    <td className="px-8 py-4 text-center">
                                        <span className={`text-[15px] font-black tracking-tighter ${log.status === 'Added' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {log.status === 'Added' ? '+' : '-'}{log.totalQuantity || log.quantityChange}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4">
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight line-clamp-1 group-hover:line-clamp-none transition-all">{log.remarks}</p>
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-tighter">{log.createdDate}</span>
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        <button onClick={() => setViewingLog(log)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl transition-all active:scale-90 shadow-sm">
                                            <Eye size={16} strokeWidth={3} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!loading && filteredLogs.length > 0 && (
                    <div className="px-10 py-6 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 shrink-0">
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rows per Page</span>
                                <div className="relative">
                                    <select 
                                        value={itemsPerPage} 
                                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                        className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-1.5 pr-8 text-[11px] font-black text-slate-700 outline-none focus:border-indigo-500 shadow-sm cursor-pointer"
                                    >
                                        {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Showing <span className="text-slate-900">{rangeStart} - {rangeEnd}</span> of <span className="text-slate-900">{filteredLogs.length}</span> Records
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                            >
                                <ChevronLeft size={18} strokeWidth={3} />
                            </button>

                            <div className="flex items-center gap-1.5">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum = i + 1;
                                    if (totalPages > 5 && currentPage > 3) {
                                        pageNum = currentPage - 3 + i + 1;
                                        if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`w-10 h-10 rounded-xl text-[11px] font-black transition-all shadow-sm active:scale-95 ${currentPage === pageNum ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            <button 
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                            >
                                <ChevronRight size={18} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* BATCH MODAL: Add / Remove Stock */}
            {isBulkModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-[1000px] h-[95vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        
                        <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                            <div className="flex items-center gap-5">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 shrink-0 ${transactionType === 'Add' ? 'bg-indigo-600' : 'bg-rose-600'}`}>
                                    {transactionType === 'Add' ? <PlusCircle size={24} /> : <MinusCircle size={24} />}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">
                                        Batch Stock {transactionType === 'Add' ? 'Inflow' : 'Outward'}
                                    </h3>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1.5">Inventory Orchestration Protocol</p>
                                </div>
                            </div>
                            <button onClick={() => setIsBulkModalOpen(false)} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all hover:rotate-90 shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 flex flex-col min-h-0 bg-[#f8fafc]">
                            {/* Compact Staging / Items Search Area */}
                            <div className="flex-1 flex flex-col p-6 space-y-4 min-h-0">
                                <div className="space-y-3 shrink-0">
                                    <div className="flex items-center gap-2 px-1">
                                        <Search size={14} className="text-indigo-500" />
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Select Hardware Node</h4>
                                    </div>
                                    
                                    <div className="flex flex-col md:flex-row items-stretch gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                        <div className="flex-1 relative group min-w-0">
                                            <input 
                                                type="text" 
                                                placeholder="SEARCH MODEL OR SPEC..." 
                                                value={modalSearch}
                                                onChange={(e) => { setModalSearch(e.target.value); setShowItemDropdown(true); setSelectedItem(null); }}
                                                onFocus={() => setShowItemDropdown(true)}
                                                className={`w-full pl-5 pr-10 py-3 bg-slate-50 border rounded-xl text-xs font-black uppercase outline-none transition-all shadow-inner ${selectedItem ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-100 focus:bg-white focus:border-indigo-400'}`}
                                            />
                                            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                            
                                            {showItemDropdown && modalSearch && modalFilteredInventory.length > 0 && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2">
                                                    {modalFilteredInventory.map(i => (
                                                        <button key={i.id} onClick={() => { setSelectedItem(i); setModalSearch(`${i.brand} ${i.model}`); setShowItemDropdown(false); }} className="w-full text-left px-5 py-3.5 hover:bg-indigo-50 border-b border-slate-50 last:border-0 flex items-center justify-between group transition-colors">
                                                            <div className="min-w-0 pr-4">
                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                    <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest px-1.5 py-0.5 bg-indigo-50 rounded border border-indigo-100">{i.brand}</span>
                                                                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest px-1.5 py-0.5 bg-emerald-50 rounded border border-emerald-100">{i.quality}</span>
                                                                </div>
                                                                <p className="text-[12px] font-black text-slate-800 uppercase truncate">{i.model}</p>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <p className="text-[11px] font-black text-emerald-600 tracking-tighter">₹{i.price.toFixed(1)}</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="w-full md:w-32">
                                            <input 
                                                type="number" 
                                                placeholder="QTY"
                                                value={qtyInput}
                                                onChange={e => setQtyInput(e.target.value)}
                                                className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl text-center text-lg font-black outline-none focus:bg-white focus:border-indigo-400 shadow-inner"
                                            />
                                        </div>

                                        <button onClick={handleAddToStage} disabled={!selectedItem || !qtyInput} className="w-full md:w-auto px-8 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50">
                                            Stage
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3 flex-1 flex flex-col min-h-0">
                                    <div className="flex items-center justify-between px-1 shrink-0">
                                        <div className="flex items-center gap-2">
                                            <List size={14} className="text-indigo-500" />
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Deployment Stage Area</h4>
                                        </div>
                                        <span className={`px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${stagedItems.length > 0 ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                            {stagedItems.length} Selection{stagedItems.length !== 1 ? 's' : ''} Staged
                                        </span>
                                    </div>
                                    
                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                                        {stagedItems.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-3xl py-12 opacity-30 grayscale">
                                                <Database size={48} className="mb-4" />
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Empty Protocol...</p>
                                            </div>
                                        ) : (
                                            stagedItems.map((si) => (
                                                <div key={si.item.id} className="p-3.5 bg-white border border-slate-100 rounded-xl flex items-center justify-between group shadow-sm hover:border-indigo-200 transition-all">
                                                    <div className="flex items-center gap-5 flex-1 min-w-0">
                                                        <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center font-black text-[10px] text-indigo-500 border border-slate-100 shrink-0 uppercase">{si.item.brand.charAt(0)}</div>
                                                        <div className="min-w-0 pr-4 flex-1">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <span className="text-[12px] font-black text-slate-900 uppercase truncate leading-none">{si.item.model}</span>
                                                                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest shrink-0">{si.item.quality}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Layers size={9}/> {si.item.warehouse || 'Main Hub'}</p>
                                                                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">₹{si.item.price.toFixed(1)}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6 shrink-0">
                                                        <div className="text-center px-4 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100 min-w-[70px]">
                                                            <p className="text-[14px] font-black text-indigo-600 tracking-tighter leading-none">{si.quantity}</p>
                                                        </div>
                                                        <button onClick={() => handleRemoveFromStage(si.item.id)} className="p-2 bg-white border border-slate-200 text-slate-300 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50 rounded-lg transition-all active:scale-90 shadow-sm">
                                                            <Trash2 size={16} strokeWidth={2.5} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Standard Modal Footer */}
                        <div className="px-10 py-6 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-8">
                                <div className="text-left">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Total Staged Units</p>
                                    <p className="text-xl font-black text-slate-900 tracking-tighter leading-none">
                                        {stagedItems.reduce((sum, si) => sum + si.quantity, 0)} Pcs
                                    </p>
                                </div>
                                <div className="w-px h-6 bg-slate-100"></div>
                                <div className="text-left">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Aggregate Lines</p>
                                    <p className="text-xl font-black text-slate-900 tracking-tighter leading-none">{stagedItems.length} Nodes</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => setIsBulkModalOpen(false)}
                                    className="px-8 py-3.5 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95"
                                >
                                    Discard
                                </button>
                                <button 
                                    disabled={stagedItems.length === 0 || isSaving} 
                                    onClick={handleCommitTransaction} 
                                    className={`px-10 py-3.5 rounded-xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 ${transactionType === 'Add' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : (
                                        <>Commit Batch Protocol <ArrowRight size={18} strokeWidth={3} /></>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL: Log Item Summary */}
            {viewingLog && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                                    <ReceiptText size={24} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Audit Payload Detail</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ref ID: {viewingLog.id.slice(-8)}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewingLog(null)} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all hover:rotate-90">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-10 space-y-10">
                            <div className="flex justify-between items-start pb-8 border-b border-slate-50">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">Target Deployment Node</p>
                                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">{viewingLog.shopName}</h3>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{viewingLog.createdDate}</span>
                                        <span className={`px-4 py-1 rounded-xl text-[9px] font-black uppercase border tracking-[0.1em] ${viewingLog.status === 'Added' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>{viewingLog.status === 'Added' ? 'Stock Inflow' : 'Stock Outward'}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Aggregate Qty</p>
                                    <h3 className={`text-5xl font-black tracking-tighter italic ${viewingLog.status === 'Added' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {viewingLog.status === 'Added' ? '+' : '-'}{viewingLog.totalQuantity || viewingLog.quantityChange}
                                    </h3>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Layers size={14}/> Node Item Breakdown</h4>
                                <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                                    {viewingLog.items ? viewingLog.items.map((it, idx) => (
                                        <div key={idx} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center group hover:bg-indigo-50/30 transition-all">
                                            <div className="min-w-0 pr-4">
                                                <p className="text-[13px] font-black text-slate-800 uppercase truncate leading-none">{it.brand} {it.model}</p>
                                                <p className="text-[9px] font-black text-slate-400 mt-2 uppercase tracking-widest">{it.quality}</p>
                                            </div>
                                            <div className={`text-lg font-black tracking-tighter ${viewingLog.status === 'Added' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                x{it.quantity}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
                                            <div className="min-w-0 pr-4">
                                                <p className="text-[13px] font-black text-slate-800 uppercase truncate leading-none">{viewingLog.modelName}</p>
                                                <p className="text-[9px] font-black text-slate-400 mt-2 uppercase tracking-widest">Hardware Specification</p>
                                            </div>
                                            <div className={`text-lg font-black tracking-tighter ${viewingLog.status === 'Added' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                x{viewingLog.quantityChange}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white p-8 rounded-[2rem] border-2 border-dashed border-slate-100">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><MessageSquare size={12}/> Auditor Reasoning</p>
                                <p className="text-[13px] font-bold text-slate-600 italic leading-relaxed uppercase tracking-tight">"{viewingLog.remarks}"</p>
                            </div>
                        </div>

                        <div className="px-10 py-8 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                            <button onClick={() => setViewingLog(null)} className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all active:scale-95">Dismiss Audit View</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
