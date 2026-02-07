
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Search, 
    RefreshCw, 
    Loader2, 
    Plus, 
    X, 
    RotateCcw, 
    Package, 
    ChevronRight, 
    History,
    Trash2,
    Info,
    ReceiptText,
    PackageSearch,
    UserCircle2,
    Eye,
    Printer,
    FileDown,
    Share2,
    Download,
    Layers,
    TrendingUp,
    Calendar,
    ArrowRight,
    ChevronUp,
    ChevronDown,
    Check,
    AlertCircle,
    Edit2,
    CheckCircle2,
    AlertTriangle,
    CreditCard,
    MessageSquare,
    ArrowLeftRight,
    MinusCircle,
    ChevronLeft,
    Activity,
    ShoppingCart,
    Box,
    ArrowLeft,
    PlusCircle,
    Trash,
    Save,
    Ban,
    Database
} from 'lucide-react';
import { Order, Customer, InventoryItem, GRInventoryItem, UserRole, OrderItem, User as UserType, InventoryLog } from '../types';
import { fetchOrders, fetchCustomers, fetchInventory, addOrderToDB, deleteOrderFromDB, updateCustomerInDB, updateOrderInDB, addInventoryLogToDB, updateInventoryItemInDB } from '../services/db';
import { useNotification } from '../context/NotificationContext';

const PAGE_SIZE_OPTIONS = [50, 100, 200, 300, 500, 1000];

interface CustomerGRProps {
    currentUser: UserType;
}

const CustomerGR: React.FC<CustomerGRProps> = ({ currentUser }) => {
    const [grs, setGrs] = useState<Order[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [mainInventory, setMainInventory] = useState<InventoryItem[]>([]);
    const [activeTab, setActiveTab] = useState<'history' | 'inventory'>('history');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { showNotification } = useNotification();

    // Date Range State - Default to last 7 days
    const [dateRange, setDateRange] = useState(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 7);
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Creation Workflow State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [grToDelete, setGrToDelete] = useState<string | null>(null);
    const [step, setStep] = useState<1 | 2 | 3>(1); 
    const [customerSearch, setCustomerSearch] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [itemSearch, setItemSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    
    // Removal Workflow State (Physical removal from stock room)
    const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
    const [removeQtyInput, setRemoveQtyInput] = useState('');
    const [itemBeingRemoved, setItemBeingRemoved] = useState<any | null>(null);

    // Direct Amount Mode State
    const [isDirectMode, setIsDirectMode] = useState(false);
    const [directAmount, setDirectAmount] = useState('');
    const [directRemarks, setDirectRemarks] = useState('');

    // Cart state handles price as string for smooth editing
    const [returnCart, setReturnCart] = useState<Record<string, { qty: number, price: string }>>({});

    // Detail View State (Invoice Mode)
    const [viewingGR, setViewingGR] = useState<Order | null>(null);
    const [viewingItems, setViewingItems] = useState<any[]>([]);
    const [stockDrillDown, setStockDrillDown] = useState<any | null>(null);

    const isGRUser = currentUser.role === 'GR';

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const [allOrders, allCustomers, allInventory] = await Promise.all([ 
            fetchOrders(currentUser.instanceId), 
            fetchCustomers(currentUser.instanceId), 
            fetchInventory(currentUser.instanceId)
        ]);
        setGrs(allOrders.filter(o => o.status === 'Return'));
        setCustomers(allCustomers); 
        setMainInventory(allInventory); 
        setLoading(false);
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadData();
        setIsRefreshing(false);
        showNotification('GR ledger synchronized');
    };

    const cartItemIds = Object.keys(returnCart);
    
    const totalCreditValue = useMemo(() => {
        if (isDirectMode) {
            return parseFloat(directAmount) || 0;
        }
        return cartItemIds.reduce((sum, id) => {
            const item = mainInventory.find(i => i.id === id);
            return sum + (returnCart[id].qty * parseFloat(returnCart[id].price || '0'));
        }, 0);
    }, [isDirectMode, directAmount, returnCart, cartItemIds, mainInventory]);

    const tabs = useMemo(() => {
        const counts: Record<string, number> = {};
        mainInventory.forEach(i => {
            if (i.status !== 'Inactive') {
                const cat = i.category || 'APEXFLOW';
                counts[cat] = (counts[cat] || 0) + 1;
            }
        });
        const categories = Object.keys(counts).sort();
        const activeTotal = mainInventory.filter(i => i.status !== 'Inactive').length;
        return [{ name: 'All', count: activeTotal }, ...categories.map(c => ({ name: c, count: counts[c] }))];
    }, [mainInventory]);

    const filteredInventoryForReturn = useMemo(() => {
        return mainInventory.filter(item => {
            if (item.status === 'Inactive') return false;
            const matchesSearch = 
                item.model.toLowerCase().includes(itemSearch.toLowerCase()) || 
                item.brand.toLowerCase().includes(itemSearch.toLowerCase());
            const matchesTab = activeCategory === 'All' || item.category === activeCategory;
            return matchesSearch && matchesTab;
        });
    }, [itemSearch, activeCategory, mainInventory]);

    const handleUpdateReturnQty = (itemId: string, val: string, defaultPrice: number) => {
        const qty = parseInt(val) || 0;
        setReturnCart(prev => {
            if (qty <= 0) {
                const { [itemId]: _, ...rest } = prev;
                return rest;
            }
            const existing = prev[itemId] || { qty: 0, price: defaultPrice.toFixed(1) };
            return { ...prev, [itemId]: { ...existing, qty } };
        });
    };

    const handleUpdateReturnPrice = (itemId: string, val: string) => {
        const sanitized = val.replace(/[^0-9.]/g, '');
        setReturnCart(prev => {
            if (!prev[itemId]) return prev;
            return { ...prev, [itemId]: { ...prev[itemId], price: sanitized } };
        });
    };

    const handlePriceBlur = (itemId: string) => {
        setReturnCart(prev => {
            if (!prev[itemId]) return prev;
            const currentPrice = parseFloat(prev[itemId].price);
            return { 
                ...prev, 
                [itemId]: { 
                    ...prev[itemId], 
                    price: isNaN(currentPrice) ? '0.0' : currentPrice.toFixed(1) 
                } 
            };
        });
    };

    const handleFinalizeGR = async () => {
        if (!selectedCustomer) return;
        if (!isDirectMode && cartItemIds.length === 0) return;
        if (isDirectMode && !directAmount) return;

        const now = new Date();
        const timestamp = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
        
        const grOrder: Order = {
            id: `GR-${Date.now()}`,
            customerId: selectedCustomer.id,
            customerName: selectedCustomer.name,
            customerSubtext: selectedCustomer.city, 
            orderTime: timestamp,
            warehouse: isDirectMode ? 'Direct Adjustment' : 'Main GR Dept',
            status: 'Return',
            totalAmount: totalCreditValue,
            invoiceStatus: 'Paid',
            orderMode: 'Offline',
            remarks: isDirectMode ? directRemarks : '',
            instanceId: currentUser.instanceId
        };

        if (!isDirectMode) {
            const itemsToStore = cartItemIds.map(id => {
                const item = mainInventory.find(i => i.id === id)!;
                return {
                    item: item,
                    returnQty: returnCart[id].qty,
                    returnPrice: parseFloat(returnCart[id].price)
                };
            });
            localStorage.setItem(`apexflow_gr_items_${grOrder.id}`, JSON.stringify(itemsToStore));

            for(const entry of itemsToStore) {
                const invItem = mainInventory.find(i => i.id === entry.item.id);
                if(invItem) {
                    const newQty = invItem.quantity + entry.returnQty;
                    await updateInventoryItemInDB({ ...invItem, quantity: newQty });
                    await addInventoryLogToDB({
                        id: `gr-in-${Date.now()}-${invItem.id}`,
                        itemId: invItem.id,
                        modelName: `${invItem.brand} ${invItem.model}`,
                        shopName: selectedCustomer.name,
                        status: 'Added',
                        totalQuantity: entry.returnQty,
                        itemCount: 1,
                        remarks: `Goods Return Entry #${grOrder.id}`,
                        createdDate: timestamp
                    });
                }
            }
        }

        try {
            const latestCustomer = customers.find(c => c.id === selectedCustomer.id);
            if (latestCustomer) {
                const updatedCustomer = { 
                    ...latestCustomer, 
                    balance: latestCustomer.balance + totalCreditValue 
                };
                await updateCustomerInDB(updatedCustomer);
            }

            await addOrderToDB(grOrder);
            setGrs([grOrder, ...grs]);
            setIsCreateModalOpen(false);
            showNotification(`GR Finalized: ₹${totalCreditValue.toFixed(1)} credited to ${selectedCustomer.name}`, 'success');
            loadData();
        } catch (err) {
            showNotification('Failed to sync GR to cloud', 'error');
        }
    };

    const handleViewGR = (gr: Order) => {
        const stored = localStorage.getItem(`apexflow_gr_items_${gr.id}`);
        if (stored) setViewingItems(JSON.parse(stored));
        else setViewingItems([]);
        setViewingGR(gr);
    };

    const handleDeleteGR = async () => {
        if (!grToDelete) return;
        try {
            await deleteOrderFromDB(grToDelete);
            localStorage.removeItem(`apexflow_gr_items_${grToDelete}`);
            setGrs(prev => prev.filter(g => g.id !== grToDelete));
            setIsDeleteConfirmOpen(false);
            setGrToDelete(null);
            showNotification('Log record removed');
        } catch (err) {
            showNotification('Failed to delete record', 'error');
        }
    };

    const handleInitiateRemove = (item: any) => {
        setItemBeingRemoved(item);
        setRemoveQtyInput('');
        setIsRemoveModalOpen(true);
    };

    const handleConfirmRemoveQty = async () => {
        if (!itemBeingRemoved || !removeQtyInput) return;
        const qtyToRemove = parseInt(removeQtyInput);
        if (isNaN(qtyToRemove) || qtyToRemove <= 0 || qtyToRemove > itemBeingRemoved.quantity) {
            showNotification('Invalid removal quantity', 'error');
            return;
        }

        setIsRefreshing(true);
        try {
            const key = `${itemBeingRemoved.brand}-${itemBeingRemoved.model}-${itemBeingRemoved.quality}`.toUpperCase();
            const storageKey = 'apexflow_gr_physical_removals';
            const existingRemovalsStr = localStorage.getItem(storageKey);
            const removalsMap = existingRemovalsStr ? JSON.parse(existingRemovalsStr) : {};
            removalsMap[key] = (removalsMap[key] || 0) + qtyToRemove;
            localStorage.setItem(storageKey, JSON.stringify(removalsMap));

            const invItem = mainInventory.find(i => 
                i.brand.toUpperCase() === itemBeingRemoved.brand.toUpperCase() && 
                i.model.toUpperCase() === itemBeingRemoved.model.toUpperCase() &&
                i.quality.toUpperCase() === itemBeingRemoved.quality.toUpperCase()
            );

            if (invItem) {
                const newQty = Math.max(0, invItem.quantity - qtyToRemove);
                const updatedItem = { ...invItem, quantity: newQty };
                await updateInventoryItemInDB(updatedItem);
                
                const now = new Date();
                const timestamp = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
                
                const log: InventoryLog = {
                    id: `gr-out-${Date.now()}-${invItem.id}`,
                    itemId: invItem.id,
                    modelName: `${invItem.brand} ${invItem.model}`,
                    shopName: 'GR Outward Shipment',
                    status: 'Removed',
                    totalQuantity: qtyToRemove,
                    itemCount: 1,
                    remarks: `Physical stock sent to manufacturer/repairs`,
                    createdDate: timestamp,
                    currentStock: newQty,
                    instanceId: currentUser.instanceId
                };
                await addInventoryLogToDB(log);

                showNotification(`${qtyToRemove} units removed from GR stock room`, 'success');
                setIsRemoveModalOpen(false);
                setItemBeingRemoved(null);
                loadData();
            }
        } catch (e) {
            showNotification('Removal failed', 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    const aggregatedStockRoom = useMemo(() => {
        const stockMap: Record<string, { model: string; brand: string; quality: string; category: string; warehouse: string; quantity: number; totalVal: number; lastDate: string; history: Array<{ customer: string; customerId?: string; date: string; qty: number }> }> = {};
        
        grs.forEach(gr => {
            const stored = localStorage.getItem(`apexflow_gr_items_${gr.id}`);
            if (stored) {
                const itemsList = JSON.parse(stored);
                itemsList.forEach((entry: any) => {
                    const key = `${entry.item.brand}-${entry.item.model}-${entry.item.quality}`.toUpperCase();
                    if (!stockMap[key]) {
                        stockMap[key] = { model: entry.item.model, brand: entry.item.brand, quality: entry.item.quality, category: entry.item.category || 'APEXFLOW', warehouse: entry.item.warehouse || 'APEXFLOW', quantity: 0, totalVal: 0, lastDate: gr.orderTime, history: [] };
                    }
                    stockMap[key].quantity += entry.returnQty;
                    stockMap[key].totalVal += (entry.returnQty * entry.returnPrice);
                    stockMap[key].lastDate = gr.orderTime; 
                    stockMap[key].history.push({ customer: gr.customerName, customerId: gr.customerId, date: gr.orderTime, qty: entry.returnQty });
                });
            }
        });

        const removalsStr = localStorage.getItem('apexflow_gr_physical_removals');
        if (removalsStr) {
            const removalsMap = JSON.parse(removalsStr);
            Object.keys(removalsMap).forEach(key => {
                if (stockMap[key]) {
                    stockMap[key].quantity -= removalsMap[key];
                    if (stockMap[key].quantity < 0) stockMap[key].quantity = 0;
                }
            });
        }

        return Object.values(stockMap)
            .filter(i => i.quantity > 0)
            .sort((a, b) => b.quantity - a.quantity);
    }, [grs]);

    const totalBilledUnits = useMemo(() => aggregatedStockRoom.reduce((sum, i) => sum + i.quantity, 0), [aggregatedStockRoom]);

    const parseOrderDate = (dateStr: string) => {
        try {
            const [dPart] = dateStr.split(' ');
            const [d, m, y] = dPart.split('/').map(Number);
            return new Date(y, m - 1, d).toISOString().split('T')[0];
        } catch (e) { return ''; }
    };

    const filteredHistory = useMemo(() => {
        return grs.filter(o => {
            const matchesSearch = o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                o.id.toLowerCase().includes(searchTerm.toLowerCase());
            
            const orderDate = parseOrderDate(o.orderTime);
            const matchesDate = orderDate >= dateRange.start && orderDate <= dateRange.end;
            
            return matchesSearch && matchesDate;
        }).sort((a, b) => b.id.localeCompare(a.id));
    }, [grs, searchTerm, dateRange]);

    const filteredStockRoom = aggregatedStockRoom.filter(i => 
        i.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const dataSource = activeTab === 'history' ? filteredHistory : filteredStockRoom;
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return dataSource.slice(startIndex, startIndex + itemsPerPage);
    }, [dataSource, currentPage, itemsPerPage]);

    return (
        <div className="flex flex-col space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Header and Stats */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 no-print">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-rose-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-rose-100 shrink-0">
                        <RotateCcw size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Goods Return Console</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Inventory Restoration & Credit Adjustment</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="flex-1 lg:flex-none flex items-center gap-4 bg-white border border-slate-200 px-8 py-3.5 rounded-3xl shadow-sm">
                        <div className="w-8 h-8 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
                            <Package size={16} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Billed Units</p>
                            <p className="text-xl font-black text-slate-800 tracking-tighter leading-none">{totalBilledUnits} Pcs</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => {
                            setStep(1);
                            setSelectedCustomer(null);
                            setReturnCart({});
                            setDirectAmount('');
                            setDirectRemarks('');
                            setIsDirectMode(false);
                            setIsCreateModalOpen(true);
                            setCustomerSearch('');
                            setItemSearch('');
                            setActiveCategory('All');
                        }}
                        className="px-10 py-4 bg-rose-600 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-rose-200 active:scale-95 transition-all"
                    >
                        <Plus size={16} className="mr-2 inline" strokeWidth={4} /> Create GR
                    </button>
                </div>
            </div>

            {/* Navigation & Search & Date Range */}
            <div className="flex flex-col xl:flex-row gap-6 items-center no-print">
                <div className="flex p-1.5 bg-slate-100 rounded-[2rem] w-full xl:w-auto">
                    <button 
                        onClick={() => { setActiveTab('history'); setCurrentPage(1); }}
                        className={`flex items-center gap-2 px-8 py-3 text-[11px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all ${activeTab === 'history' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <History size={16} /> Return History
                    </button>
                    <button 
                        onClick={() => { setActiveTab('inventory'); setCurrentPage(1); }}
                        className={`flex items-center gap-2 px-8 py-3 text-[11px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all ${activeTab === 'inventory' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <PackageSearch size={16} /> GR Stock Room
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center flex-1 w-full">
                    <div className="relative flex-1 w-full group">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500 transition-colors">
                            <Search size={20} />
                        </div>
                        <input 
                            type="text" 
                            placeholder={`Search ${activeTab === 'history' ? 'client or return id' : 'model or brand'}...`}
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-14 pr-14 py-4 bg-white border border-slate-200 rounded-[2.5rem] text-[13px] font-bold uppercase tracking-tight text-slate-800 outline-none focus:ring-8 focus:ring-rose-50/5 transition-all shadow-sm"
                        />
                    </div>

                    {activeTab === 'history' && (
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-[2.5rem] px-6 py-2 shadow-sm">
                            <Calendar size={16} className="text-rose-500" />
                            <div className="flex items-center gap-2">
                                <input 
                                    type="date" 
                                    value={dateRange.start} 
                                    onChange={(e) => { setDateRange({...dateRange, start: e.target.value}); setCurrentPage(1); }}
                                    className="bg-transparent text-[11px] font-black uppercase outline-none text-slate-600"
                                />
                                <span className="text-slate-300 font-bold">TO</span>
                                <input 
                                    type="date" 
                                    value={dateRange.end} 
                                    onChange={(e) => { setDateRange({...dateRange, end: e.target.value}); setCurrentPage(1); }}
                                    className="bg-transparent text-[11px] font-black uppercase outline-none text-slate-600"
                                />
                            </div>
                        </div>
                    )}

                    <button onClick={handleRefresh} className="p-4 bg-white border border-slate-200 rounded-full text-slate-300 hover:text-rose-500 transition-all active:rotate-180 duration-500 shadow-sm">
                        <RefreshCw size={20} strokeWidth={2.5} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Main List Table */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col no-print">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                {activeTab === 'history' ? (
                                    <>
                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Return Details</th>
                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Identity</th>
                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Value Impact</th>
                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Stock Item</th>
                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Quality / Grade</th>
                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">In-Hand Stock</th>
                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={4} className="py-40 text-center"><Loader2 className="animate-spin text-rose-500 mx-auto" size={32} /></td></tr>
                            ) : paginatedData.length === 0 ? (
                                <tr><td colSpan={4} className="py-40 text-center"><ReceiptText size={48} className="text-slate-100 mx-auto mb-4" /></td></tr>
                            ) : paginatedData.map((item: any, idx: number) => (
                                <tr key={activeTab === 'history' ? item.id : idx} className="hover:bg-slate-50/50 transition-all group">
                                    {activeTab === 'history' ? (
                                        <>
                                            <td className="px-10 py-6"><div className="flex flex-col"><span className="text-[14px] font-black text-slate-900 uppercase tracking-tight">{item.orderTime}</span><span className="text-[10px] font-bold text-slate-400 uppercase">Ref ID: #{item.id.toString().slice(-10)}</span></div></td>
                                            <td className="px-10 py-6"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-black text-xs">{item.customerName.charAt(0)}</div><span className="text-[13px] font-bold text-slate-700 uppercase tracking-tight">{item.customerName}</span></div></td>
                                            <td className="px-10 py-6"><span className="text-lg font-black text-emerald-600 tracking-tighter">+₹{Math.abs(item.totalAmount || 0).toFixed(1)}</span></td>
                                            <td className="px-10 py-6 text-right"><div className="flex items-center justify-end gap-2"><button onClick={() => handleViewGR(item)} className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"><Eye size={14} strokeWidth={3} /> View</button><button onClick={() => { setGrToDelete(item.id); setIsDeleteConfirmOpen(true); }} className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"><Trash2 size={14} strokeWidth={3} /> Delete</button></div></td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-10 py-6"><div className="flex flex-col"><span className="text-[13px] font-black text-slate-900 uppercase tracking-tight mb-1">{item.model}</span><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.brand} | {item.category}</span></div></td>
                                            <td className="px-10 py-6"><span className="inline-block px-3 py-1 bg-slate-50 text-slate-500 border border-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest">{item.quality}</span></td>
                                            <td className="px-10 py-6 text-center"><button onClick={() => setStockDrillDown(item)} className="px-4 py-1.5 bg-rose-50 text-rose-600 rounded-xl font-black text-[14px] border border-rose-100 hover:bg-rose-600 hover:text-white transition-all flex items-center gap-2 mx-auto">{item.quantity} Units <ChevronRight size={14} strokeWidth={3} /></button></td>
                                            <td className="px-10 py-6 text-right"><button onClick={() => handleInitiateRemove(item)} className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"><MinusCircle size={14} strokeWidth={3} /> Send Out</button></td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CREATE GR MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-2 md:p-6 animate-in fade-in duration-300">
                    <div className="bg-[#f8fafc] rounded-[2.5rem] shadow-2xl w-full max-w-[1600px] h-[95vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <header className="bg-white border-b border-slate-100 shrink-0">
                            <div className="px-6 md:px-10 h-20 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><RotateCcw size={28} /></div>
                                    <div>
                                        <h3 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">
                                            {step === 1 ? 'Select Recipient Client' : step === 2 ? 'Configuring Return Catalog' : 'Review Transmission'}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                                            {selectedCustomer ? `CLIENT NODE: ${selectedCustomer.name}` : 'Initializing Stock Restoration Protocol'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setIsCreateModalOpen(false)} className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all active:scale-95"><X size={20} strokeWidth={3}/></button>
                            </div>
                        </header>

                        {step === 1 ? (
                            <div className="flex-1 p-6 md:p-12 flex flex-col min-h-0 overflow-hidden bg-slate-50/30">
                                <div className="relative mb-10 max-w-2xl mx-auto w-full group"><Search size={22} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-rose-500 transition-colors" /><input type="text" placeholder="Find customer by name, phone or city..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="w-full pl-14 pr-8 py-5 bg-white border border-slate-200 rounded-[2.5rem] outline-none font-bold text-lg focus:ring-8 focus:ring-rose-50 transition-all shadow-sm" /></div>
                                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar max-w-4xl mx-auto w-full">
                                    {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).map(customer => (
                                        <button key={customer.id} onClick={() => { setSelectedCustomer(customer); setStep(2); }} className="w-full bg-white p-7 rounded-[2rem] border border-slate-100 flex items-center justify-between hover:border-rose-400 hover:translate-x-2 transition-all group shadow-sm">
                                            <div className="flex items-center gap-6">
                                                <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black text-xl group-hover:bg-rose-600 group-hover:text-white transition-all shadow-inner">{customer.name.charAt(0)}</div>
                                                <div className="text-left"><p className="text-xl font-black text-slate-800 uppercase tracking-tight">{customer.name}</p><p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">{customer.phone} | {customer.city}</p></div>
                                            </div>
                                            <div className="flex items-center gap-4"><span className="text-[11px] font-black text-slate-300 uppercase tracking-widest group-hover:text-rose-500">Initiate</span><ChevronRight size={24} className="text-slate-100 group-hover:text-rose-500" /></div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : step === 2 ? (
                            <div className="flex-1 flex flex-col min-h-0 bg-[#f8fafc] relative">
                                <div className="px-6 md:px-10 py-6 space-y-6 bg-white border-b border-slate-100 shadow-sm sticky top-0 z-30">
                                    <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200 w-full max-w-md mx-auto"><button onClick={() => setIsDirectMode(false)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${!isDirectMode ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400'}`}>Detailed Catalog</button><button onClick={() => setIsDirectMode(true)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${isDirectMode ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400'}`}>Direct Adjustment</button></div>
                                    {!isDirectMode && (<div className="space-y-4 max-w-3xl mx-auto w-full"><div className="relative group"><Search size={22} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-rose-500 transition-colors" /><input type="text" placeholder="FILTER MODELS, BRANDS, CATEGORIES..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-black uppercase tracking-widest outline-none focus:bg-white focus:border-rose-500 transition-all shadow-inner" /></div><div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar justify-center">{tabs.map(tab => (<button key={tab.name} onClick={() => setActiveCategory(tab.name)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${activeCategory === tab.name ? 'bg-rose-600 text-white border-rose-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>{tab.name} ({tab.count})</button>))}</div></div>)}
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-4 custom-scrollbar pb-32">
                                    {!isDirectMode ? (<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">{filteredInventoryForReturn.map(item => (<div key={item.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-8 group hover:border-rose-200 transition-all"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-2.5"><span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded text-[9px] font-black uppercase tracking-widest">{item.brand}</span><span className="px-2 py-0.5 bg-slate-50 text-slate-400 border border-slate-100 rounded text-[9px] font-black uppercase tracking-widest">{item.quality}</span></div><h3 className="text-[16px] font-black text-slate-900 uppercase leading-tight truncate">{item.model}</h3></div><div className="flex items-center gap-8 shrink-0"><div className="text-right w-28"><p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Return Rate (₹)</p><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 font-black text-[10px]">₹</span><input type="text" value={returnCart[item.id]?.price ?? item.price.toFixed(1)} onChange={e => handleUpdateReturnPrice(item.id, e.target.value)} onBlur={() => handlePriceBlur(item.id)} className="w-full pl-5 pr-2 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs font-black text-emerald-600 outline-none focus:bg-white focus:border-emerald-400" /></div></div><div className="w-28"><p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1 text-center">Return Qty</p><input type="number" min="0" value={returnCart[item.id]?.qty || ''} onChange={e => handleUpdateReturnQty(item.id, e.target.value, item.price)} placeholder="0" className="w-full h-11 border-2 rounded-xl text-center text-sm font-black outline-none transition-all bg-slate-50 border-slate-100 focus:bg-white focus:border-rose-500 shadow-inner" /></div></div></div>))}</div>) : (<div className="max-w-2xl mx-auto w-full p-12 bg-white rounded-[3rem] shadow-xl border border-slate-100 space-y-10 mt-10"><div className="space-y-4"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Total Credit Value (₹)</label><div className="relative"><span className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-200 text-5xl font-black">₹</span><input type="number" value={directAmount} onChange={e => setDirectAmount(e.target.value)} placeholder="0.00" className="w-full pl-20 pr-8 py-12 bg-slate-50 border-2 border-slate-100 rounded-[3rem] text-7xl font-black outline-none focus:bg-white focus:border-rose-400 transition-all shadow-inner text-indigo-600" autoFocus /></div></div><div className="space-y-4"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Audit Remark / Reasoning</label><textarea value={directRemarks} onChange={e => setDirectRemarks(e.target.value)} placeholder="ENTER REASON FOR THIS MANUAL ADJUSTMENT..." className="w-full px-8 py-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] text-sm font-bold uppercase outline-none focus:bg-white focus:border-rose-400 min-h-[180px] resize-none shadow-inner leading-relaxed" /></div></div>)}
                                </div>
                                {((!isDirectMode && cartItemIds.length > 0) || (isDirectMode && directAmount)) && (<div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl z-40"><button onClick={() => setStep(3)} className="w-full bg-rose-600 text-white rounded-[2.5rem] p-8 shadow-2xl flex items-center justify-between active:scale-95 transition-all group overflow-hidden"><div className="flex items-center gap-5"><div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white relative"><RotateCcw size={28} strokeWidth={2.5} /><span className="absolute -top-2 -right-2 w-7 h-7 bg-emerald-500 text-white text-[11px] font-black rounded-full flex items-center justify-center border-4 border-rose-600">{!isDirectMode ? cartItemIds.length : '1'}</span></div><div className="text-left"><h4 className="text-[12px] font-black uppercase tracking-widest opacity-80 leading-none">AGGREGATED CREDIT</h4><p className="text-3xl font-black tracking-tighter mt-1 italic">₹{totalCreditValue.toFixed(1)}</p></div></div><div className="flex items-center gap-4 pl-10 border-l border-white/20"><span className="text-base font-black uppercase tracking-[0.2em]">REVIEW DATA</span><ArrowRight size={24} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" /></div></button></div>)}
                            </div>
                        ) : (
                            <div className="flex-1 p-6 md:p-16 bg-[#f8fafc] overflow-y-auto custom-scrollbar animate-in fade-in duration-300"><div className="max-w-4xl mx-auto space-y-10"><button onClick={() => setStep(2)} className="flex items-center gap-3 text-slate-400 hover:text-rose-600 font-black text-[11px] uppercase tracking-widest transition-colors"><ArrowLeft size={18} strokeWidth={3} /> Adjust Selection Payload</button><div className="bg-white rounded-[3.5rem] p-12 shadow-2xl border border-slate-100"><div className="flex items-center gap-6 mb-12"><div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center shadow-inner"><ReceiptText size={32} /></div><div><h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">GR Submission Summary</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Node Verification Step</p></div></div><div className="space-y-6 mb-16">{!isDirectMode ? (<div className="divide-y divide-slate-50 bg-slate-50/50 rounded-[2.5rem] p-8 border border-slate-100">{cartItemIds.map(id => { const i = mainInventory.find(x => x.id === id)!; return (<div key={id} className="flex justify-between items-center py-5"><div className="min-w-0 pr-6"><p className="text-[15px] font-black text-slate-800 uppercase truncate leading-none">{i.brand} {i.model}</p><p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest">{i.quality}</p></div><div className="text-right shrink-0"><p className="text-[14px] font-black text-slate-900 leading-none">{returnCart[id].qty} x ₹{parseFloat(returnCart[id].price).toFixed(1)}</p><p className="text-[16px] font-black text-emerald-600 mt-1.5 italic tracking-tighter">₹{(returnCart[id].qty * parseFloat(returnCart[id].price)).toFixed(1)}</p></div></div>); })}</div>) : (<div className="py-16 text-center space-y-6 bg-slate-50/50 rounded-[3rem] border border-slate-100"><div className="inline-flex px-8 py-3 bg-rose-100 text-rose-600 border border-rose-200 rounded-full text-[11px] font-black uppercase tracking-widest">DIRECT CREDIT VOUCHER</div><p className="text-3xl font-black text-slate-700 uppercase tracking-tight px-10">"{directRemarks || 'Voucher Adjustment Entry'}"</p></div>)}<div className="pt-10 flex justify-between items-center border-t border-slate-200 border-dashed"><div><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Final Balance Credit Allocation</span><p className="text-[9px] font-bold text-slate-300 uppercase mt-1">Authorized Digital Transaction</p></div><span className="text-6xl font-black text-rose-600 italic tracking-tighter">₹{totalCreditValue.toFixed(1)}</span></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12"><div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-inner flex flex-col justify-center"><div className="flex items-center gap-3 mb-3"><UserCircle2 size={18} className="text-indigo-500" /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recipient Customer Node</p></div><p className="text-xl font-black text-slate-900 uppercase leading-none">{selectedCustomer?.name}</p><p className="text-[11px] font-bold text-slate-500 uppercase mt-2">{selectedCustomer?.city} | {selectedCustomer?.phone}</p></div><div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-inner flex flex-col justify-center items-center text-center"><div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-3 shadow-sm"><Activity size={24} className="text-rose-500" /></div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Status</p><p className="text-[12px] font-black text-emerald-600 uppercase mt-1">Pending Sync</p></div></div><button onClick={handleFinalizeGR} className="w-full py-8 bg-rose-600 text-white rounded-[2.5rem] font-black uppercase text-[15px] tracking-[0.2em] shadow-2xl shadow-rose-200 hover:bg-rose-700 transition-all flex items-center justify-center gap-4 active:scale-[0.98]">Confirm & Authorize Credit Injection <CheckCircle2 size={28} strokeWidth={3} /></button></div><div className="text-center"><p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.5em]">Certified Digital Transmission Endpoint</p></div></div></div>
                        )}
                    </div>
                </div>
            )}

            {/* --- GR INVOICE/DETAILS POPUP MODAL --- */}
            {viewingGR && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300 print:static print:bg-white print:p-0">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 print:shadow-none print:border-none print:rounded-none animate-in zoom-in-95">
                        
                        {/* Modal Header */}
                        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 no-print shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-rose-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                                    <RotateCcw size={20} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">Credit Note Details</h3>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ref ID: #{viewingGR.id.toString().slice(-8)}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewingGR(null)} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Scrollable Invoice Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 bg-white print:p-0">
                            <div className="w-full mx-auto font-sans text-slate-900 flex flex-col">
                                
                                {/* Identity & Amount Summary */}
                                <div className="flex flex-col sm:flex-row justify-between items-start mb-12 gap-8 pb-10 border-b border-slate-50">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2"><UserCircle2 size={12} className="text-rose-500" /> Client Node</p>
                                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">{viewingGR.customerName}</h3>
                                            <div className="flex items-center gap-3 mt-3">
                                                <span className="px-2.5 py-1 bg-slate-50 text-slate-500 border border-slate-100 rounded-lg text-[9px] font-black uppercase tracking-widest">{viewingGR.customerSubtext}</span>
                                                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{viewingGR.orderTime}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <p className="text-rose-400 text-[9px] font-black uppercase tracking-[0.3em] mb-2">Net Credit Injected</p>
                                        <h3 className="text-5xl font-black tracking-tighter italic text-rose-600 leading-none">₹{Math.abs(viewingGR.totalAmount || 0).toFixed(1)}</h3>
                                        <p className="text-[8px] font-bold text-slate-300 uppercase mt-3 tracking-[0.2em]">Authorized Transaction</p>
                                    </div>
                                </div>

                                {/* Items Table */}
                                <div className="flex-1">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                        <Layers size={14} className="text-slate-300" /> Restoration Catalog Breakdown
                                    </h4>
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="border-y-2 border-slate-900 bg-slate-50/50">
                                                <th className="py-4 px-1 text-left text-[9px] font-black uppercase tracking-widest text-slate-900">Description</th>
                                                <th className="py-4 px-1 text-center text-[9px] font-black uppercase tracking-widest text-slate-900 w-12">Qty</th>
                                                <th className="py-4 px-1 text-center text-[9px] font-black uppercase tracking-widest text-slate-900 w-24">Rate</th>
                                                <th className="py-4 px-1 text-right text-[9px] font-black uppercase tracking-widest text-slate-900 w-28">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {viewingItems.length > 0 ? viewingItems.map((entry, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/30">
                                                    <td className="py-5 px-1">
                                                        <p className="text-[12px] font-black text-slate-800 uppercase leading-tight mb-1">{entry.item.brand} {entry.item.model}</p>
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.1em]">{entry.item.quality}</p>
                                                    </td>
                                                    <td className="py-5 px-1 text-center font-black text-slate-900 text-sm">{entry.returnQty}</td>
                                                    <td className="py-5 px-1 text-center font-bold text-slate-500 text-xs italic">₹{entry.returnPrice.toFixed(1)}</td>
                                                    <td className="py-5 px-1 text-right font-black text-rose-600 text-[14px] tracking-tight">₹{(entry.returnQty * entry.returnPrice).toFixed(1)}</td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={4} className="py-12 px-1">
                                                        <p className="text-[13px] font-black text-slate-800 uppercase leading-tight text-center">Direct Adjustment Voucher</p>
                                                        <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase italic text-center tracking-widest">No hardware item mapping provided for this record.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-slate-900 text-white border-t-2 border-slate-900">
                                                <td colSpan={3} className="py-6 px-6 text-sm font-black uppercase tracking-[0.2em]">Aggr. Balance Impact</td>
                                                <td className="py-6 px-6 text-right text-3xl font-black tracking-tighter italic text-emerald-400">₹{Math.abs(viewingGR.totalAmount || 0).toFixed(1)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {viewingGR.remarks && (
                                    <div className="mt-10 p-6 bg-slate-50 border border-dashed border-slate-200 rounded-[2rem]">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><MessageSquare size={12} className="text-slate-300"/> Auditor Remark</p>
                                        <p className="text-[12px] font-bold text-slate-700 uppercase tracking-tight leading-relaxed italic">"{viewingGR.remarks}"</p>
                                    </div>
                                )}

                                <div className="text-center mt-12 pt-10 border-t border-slate-100">
                                    <div className="flex items-center justify-center gap-3 text-slate-300">
                                        <Info size={14} />
                                        <p className="text-[9px] font-black uppercase tracking-[0.4em]">Certified Network Node Signal</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Action Strip */}
                        <div className="px-8 py-5 bg-white border-t border-slate-100 flex flex-wrap justify-center sm:justify-end gap-3 no-print shrink-0">
                            <button onClick={() => { 
                                const summary = `*APEXFLOW CREDIT NOTE*\nRef: #${viewingGR.id.slice(-8)}\nClient: ${viewingGR.customerName}\nAmount: ₹${Math.abs(viewingGR.totalAmount || 0).toFixed(1)}\nDate: ${viewingGR.orderTime}`;
                                navigator.clipboard.writeText(summary);
                                showNotification('Summary Copied');
                            }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all hover:bg-emerald-100"><Share2 size={16}/> Share</button>
                            
                            <button onClick={() => window.print()} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all hover:bg-indigo-700"><Printer size={16}/> Print Copy</button>
                            
                            <button onClick={() => setViewingGR(null)} className="w-full sm:w-auto px-10 py-3 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">Dismiss</button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE LIST RECORD CONFIRM */}
            {isDeleteConfirmOpen && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-[340px] overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="p-8 text-center"><div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner"><AlertTriangle size={28} /></div><h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">Delete Record?</h3><p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest">Only deletes the log entry. Customer balance and inventory will NOT be reverted automatically.</p></div>
                        <div className="flex border-t border-slate-50"><button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 hover:bg-slate-50 transition-colors">Abort</button><button onClick={handleDeleteGR} className="flex-1 py-4 text-[10px] font-black uppercase bg-rose-600 text-white hover:bg-rose-700 shadow-inner">Yes, Delete</button></div>
                    </div>
                </div>
            )}

            {/* STOCK REMOVAL MODAL */}
            {isRemoveModalOpen && itemBeingRemoved && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-rose-50/50"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-lg"><MinusCircle size={20} /></div><h3 className="text-base font-black text-slate-800 uppercase">Physical Outward</h3></div><button onClick={() => setIsRemoveModalOpen(false)} className="w-8 h-8 rounded-full bg-white border border-slate-100 text-slate-400 flex items-center justify-center hover:text-rose-500"><X size={16} /></button></div>
                        <div className="p-8 space-y-6"><div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-2"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Stock Node Identity</p><p className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">{itemBeingRemoved.brand} {itemBeingRemoved.model}</p><p className="text-2xl font-black text-rose-600 tracking-tighter italic">In-Hand: {itemBeingRemoved.quantity} Pcs</p></div><div className="space-y-2"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Removal Quantity</label><input type="number" min="1" max={itemBeingRemoved.quantity} value={removeQtyInput} onChange={e => setRemoveQtyInput(e.target.value)} className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-center text-3xl font-black outline-none focus:bg-white focus:border-rose-400 transition-all" autoFocus placeholder="0" /></div><p className="text-[10px] text-amber-600 font-bold uppercase text-center leading-relaxed">Note: Removing items from stock room will NOT affect the customer's historical GR bill.</p><button onClick={handleConfirmRemoveQty} disabled={!removeQtyInput || parseInt(removeQtyInput) > itemBeingRemoved.quantity} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-rose-100 active:scale-95 disabled:opacity-50 transition-all">Authorize Outward Movement</button></div>
                    </div>
                </div>
            )}

            {/* STOCK DRILL DOWN MODAL */}
            {stockDrillDown && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[180] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl h-[70vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-lg"><Activity size={20} /></div><h3 className="text-base font-black text-slate-800 uppercase">{stockDrillDown.model} - Audit</h3></div><button onClick={() => setStockDrillDown(null)} className="w-8 h-8 rounded-full bg-white border border-slate-100 text-slate-400 flex items-center justify-center hover:text-rose-500"><X size={16} /></button></div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                            {stockDrillDown.history.map((entry: any, i: number) => (
                                <div key={i} className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex items-center justify-between"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-indigo-600 flex items-center justify-center font-black text-xs">{entry.customer.charAt(0)}</div><div><p className="text-[13px] font-black text-slate-800 uppercase leading-none">{entry.customer}</p><p className="text-[9px] font-bold text-slate-400 mt-1">{entry.date}</p></div></div><div className="text-right"><span className="text-lg font-black text-rose-600">+{entry.qty}</span><p className="text-[8px] font-black text-slate-300 uppercase">Incoming</p></div></div>
                            ))}
                        </div>
                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0"><button onClick={() => setStockDrillDown(null)} className="px-8 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm active:scale-95">Close Audit</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerGR;
