import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, 
    RefreshCw, 
    Plus, 
    Building, 
    Pencil, 
    X, 
    Loader2,
    MapPin,
    Hash,
    Building2,
    History,
    ReceiptText,
    Info,
    ChevronRight,
    Users,
    ChevronDown,
    ChevronLeft
} from 'lucide-react';
import { Firm, Customer, Order } from '../types';
import { fetchFirms, addFirmToDB, updateFirmInDB, fetchCustomers, fetchOrders } from '../services/db';
import { useNotification } from '../context/NotificationContext';

const PAGE_SIZE_OPTIONS = [50, 100, 200, 300, 500, 1000];

const CustomerFirms: React.FC = () => {
    const [firms, setFirms] = useState<Firm[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [allOrders, setAllOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const { showNotification } = useNotification();
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Search & Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null);

    // Form Data
    const [formData, setFormData] = useState<Partial<Firm>>({
        name: '',
        gstin: '',
        address: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [firmsData, customersData, ordersData] = await Promise.all([
            fetchFirms(),
            fetchCustomers(),
            fetchOrders()
        ]);
        setFirms(firmsData);
        setCustomers(customersData);
        setAllOrders(ordersData);
        setLoading(false);
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadData();
        setIsRefreshing(false);
        showNotification('Firm records synchronized');
    };

    const openCreateModal = () => {
        setIsEditMode(false);
        setFormData({ name: '', gstin: '', address: '' });
        setSelectedFirm(null);
        setIsModalOpen(true);
    };

    const openEditModal = (firm: Firm) => {
        setIsEditMode(true);
        setSelectedFirm(firm);
        setFormData({
            name: firm.name,
            gstin: firm.gstin || '',
            address: firm.address || ''
        });
        setIsModalOpen(true);
    };

    const openHistoryModal = (firm: Firm) => {
        setSelectedFirm(firm);
        setIsHistoryModalOpen(true);
    };

    const handleSaveFirm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            showNotification('Firm Name is required', 'error');
            return;
        }

        const now = new Date().toISOString();
        if (isEditMode && selectedFirm) {
            const updatedFirm: Firm = {
                ...selectedFirm,
                ...formData as Firm,
                updatedAt: now
            };
            setFirms(prev => prev.map(f => f.id === selectedFirm.id ? updatedFirm : f));
            await updateFirmInDB(updatedFirm);
            showNotification('Business identity updated');
        } else {
            const newFirm: Firm = {
                id: `f-${Date.now()}`,
                name: formData.name!,
                gstin: formData.gstin,
                address: formData.address,
                createdAt: now
            };
            setFirms(prev => [newFirm, ...prev]);
            await addFirmToDB(newFirm);
            showNotification('New firm entity registered');
        }
        setIsModalOpen(false);
    };

    const filteredFirms = useMemo(() => {
        return firms.filter(f => 
            f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.gstin && f.gstin.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [firms, searchTerm]);

    const totalPages = Math.ceil(filteredFirms.length / itemsPerPage);
    const paginatedFirms = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredFirms.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredFirms, currentPage, itemsPerPage]);

    const rangeStart = filteredFirms.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const rangeEnd = Math.min(currentPage * itemsPerPage, filteredFirms.length);

    const firmHistory = useMemo(() => {
        if (!selectedFirm) return [];
        const firmMembers = customers.filter(c => c.firmId === selectedFirm.name);
        const memberNames = firmMembers.map(m => m.name);
        return allOrders.filter(o => memberNames.includes(o.customerName));
    }, [selectedFirm, customers, allOrders]);

    const firmBalance = useMemo(() => {
        if (!selectedFirm) return 0;
        const firmMembers = customers.filter(c => c.firmId === selectedFirm.name);
        return firmMembers.reduce((sum, c) => sum + (c.balance || 0), 0);
    }, [selectedFirm, customers]);

    return (
        <div className="flex flex-col space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 px-1">
                <div className="relative w-full lg:max-w-2xl group">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                        <Search size={20} strokeWidth={2.5} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by firm name or GSTID..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full pl-14 pr-8 py-4 bg-white border border-slate-200 rounded-[2.5rem] text-[13px] font-bold uppercase tracking-tight text-slate-800 outline-none focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all shadow-sm placeholder-slate-300"
                    />
                </div>
                
                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <button 
                        onClick={handleRefresh}
                        className="p-4 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-indigo-600 shadow-sm transition-all active:rotate-180 duration-700"
                    >
                        <RefreshCw size={20} strokeWidth={2.5} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={openCreateModal} className="flex-1 lg:flex-none flex items-center justify-center px-10 py-4 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-95 whitespace-nowrap">
                        <Plus size={16} className="mr-2" strokeWidth={4} /> Register Firm
                    </button>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Business Identity</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Tax ID (GSTIN)</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Registered Location</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Members</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Since</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-32 text-center">
                                        <Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} />
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mt-4">Syncing...</p>
                                    </td>
                                </tr>
                            ) : paginatedFirms.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-32 text-center">
                                        <Building2 size={40} className="text-slate-100 mx-auto mb-4" />
                                        <p className="text-xs font-black text-slate-300 uppercase">No firms found</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedFirms.map((firm) => {
                                    const linkedMembers = customers.filter(c => c.firmId === firm.name).length;
                                    return (
                                        <tr key={firm.id} className="group hover:bg-slate-50/50 transition-all">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner shrink-0 group-hover:scale-110 transition-transform">
                                                        <Building size={20} strokeWidth={2.5} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[14px] font-black text-slate-800 uppercase tracking-tight leading-none mb-1">{firm.name}</p>
                                                        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">ID: {firm.id}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="text-[12px] font-black text-slate-600 font-mono tracking-wider bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                                    {firm.gstin || 'NOT FILED'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-start gap-2 max-w-[300px]">
                                                    <MapPin size={12} className="text-slate-300 mt-0.5 shrink-0" />
                                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight leading-relaxed line-clamp-1 group-hover:line-clamp-none transition-all">
                                                        {firm.address || 'No address'}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                                                    <Users size={12} strokeWidth={2.5} />
                                                    <span className="text-[11px] font-black">{linkedMembers}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="text-[11px] font-bold text-slate-400 uppercase">
                                                    {firm.createdAt ? new Date(firm.createdAt).toLocaleDateString('en-GB') : '-'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => openHistoryModal(firm)}
                                                        className="p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-90"
                                                        title="Ledger"
                                                    >
                                                        <History size={16} strokeWidth={3} />
                                                    </button>
                                                    <button 
                                                        onClick={() => openEditModal(firm)}
                                                        className="p-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-90"
                                                        title="Edit"
                                                    >
                                                        <Pencil size={16} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && filteredFirms.length > 0 && (
                    <div className="px-10 py-6 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 shrink-0">
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page Size</span>
                                <div className="relative">
                                    <select 
                                        value={itemsPerPage} 
                                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                        className="appearance-none bg-white border border-slate-200 rounded-xl px-5 py-2 pr-10 text-[11px] font-black text-slate-700 outline-none focus:border-indigo-500 shadow-sm cursor-pointer"
                                    >
                                        {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Showing <span className="text-slate-900">{rangeStart}-{rangeEnd}</span> of <span className="text-slate-900">{filteredFirms.length}</span>
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

            {isHistoryModalOpen && selectedFirm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                                    <History size={28} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">{selectedFirm.name} - Ledger</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Combined Audit Trail</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Closing Credit</p>
                                    <p className={`text-2xl font-black tracking-tighter ${firmBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {firmBalance < 0 ? '-' : ''}₹{Math.abs(firmBalance).toFixed(1)}
                                    </p>
                                </div>
                                <button onClick={() => setIsHistoryModalOpen(false)} className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all hover:rotate-90 shadow-sm">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                            <div className="p-10">
                                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Timestamp</th>
                                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Ref ID</th>
                                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Operator</th>
                                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Type</th>
                                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Credit Delta</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {firmHistory.length > 0 ? firmHistory.map((order) => (
                                                <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-8 py-6">
                                                        <span className="text-[12px] font-bold text-slate-500 uppercase">{order.orderTime}</span>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <span className="text-[12px] font-black text-slate-900 uppercase">#{order.id.toString().slice(-8)}</span>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-black text-indigo-500 uppercase tracking-tight">{order.customerName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <span className={`inline-block px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                                                            order.status === 'Payment' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                            order.status === 'Return' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                            'bg-indigo-50 text-indigo-600 border-indigo-100'
                                                        }`}>
                                                            {order.status}
                                                        </span>
                                                    </td>
                                                    <td className={`px-8 py-6 text-right font-black tracking-widest text-[14px] ${
                                                        order.status === 'Payment' || order.status === 'Return' ? 'text-emerald-600' : 'text-slate-800'
                                                    }`}>
                                                        {order.status === 'Payment' || order.status === 'Return' ? '+' : '-'}₹{Math.abs(order.totalAmount || 0).toFixed(1)}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={5} className="py-40 text-center">
                                                        <ReceiptText size={48} className="text-slate-100 mx-auto mb-4" />
                                                        <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em]">No financial history found</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div className="px-10 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-slate-400">
                                <Info size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Aggregated from {customers.filter(c => c.firmId === selectedFirm.name).length} members</span>
                            </div>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="px-8 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all shadow-sm active:scale-95">Close Ledger</button>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                                    {isEditMode ? 'Modify Firm Info' : 'New Firm Registry'}
                                </h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Authorized Profile Manager</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all hover:rotate-90">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSaveFirm} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Legal Name <span className="text-rose-500">*</span></label>
                                <div className="relative">
                                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold uppercase outline-none focus:bg-white focus:border-indigo-500 transition-all placeholder-slate-300" placeholder="ENTER FIRM NAME..." />
                                    <Building2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">GSTIN (Optional)</label>
                                <div className="relative">
                                    <input type="text" value={formData.gstin} onChange={e => setFormData({...formData, gstin: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold uppercase outline-none focus:bg-white focus:border-indigo-500 transition-all placeholder-slate-300 font-mono tracking-wider" placeholder="15-DIGIT GSTID..." />
                                    <Hash size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Registered Address</label>
                                <div className="relative">
                                    <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold uppercase outline-none focus:bg-white focus:border-indigo-500 transition-all placeholder-slate-300 min-h-[100px] resize-none" placeholder="FULL BUSINESS ADDRESS..." />
                                    <MapPin size={18} className="absolute right-4 top-4 text-slate-300" />
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">Cancel</button>
                                <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">{isEditMode ? 'Update Node' : 'Initialize Node'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerFirms;