
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
    ReceiptText,
    PackageSearch,
    UserCircle2,
    Calendar,
    ArrowRight,
    CheckCircle2,
    MinusCircle,
    Activity,
    ArrowLeft,
    Eye,
    FileText,
    Printer,
    ZoomIn,
    ZoomOut,
    Maximize2,
    RotateCw,
    Download,
    MoreVertical,
    Trash2,
    CheckSquare,
    Menu as MenuIcon
} from 'lucide-react';
import { isCloudActive } from '../firebaseConfig';
import { Order, Customer, InventoryItem, GRInventoryItem, UserRole, OrderItem, User as UserType, InventoryLog } from '../types';
import { fetchOrders, fetchCustomers, fetchInventory, addOrderToDB, deleteOrderFromDB, updateCustomerInDB, updateOrderInDB, addInventoryLogToDB, updateInventoryItemInDB } from '../services/db';
import { useNotification } from '../context/NotificationContext';

const PAGE_SIZE_OPTIONS = [50, 100, 200, 300, 500, 1000];

interface CustomerGRProps {
    currentUser: UserType;
    allUsers: UserType[];
}

const CustomerGR: React.FC<CustomerGRProps> = ({ currentUser, allUsers }) => {
    const [grs, setGrs] = useState<Order[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [mainInventory, setMainInventory] = useState<InventoryItem[]>([]);
    const [activeTab, setActiveTab] = useState<'history' | 'inventory'>('history');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { showNotification } = useNotification();

    const superAdminName = useMemo(() => {
        const admin = allUsers.find(u => u.role === 'Super Admin');
        return admin ? admin.name : 'APEX FLOWW';
    }, [allUsers]);

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
    const [isCreating, setIsCreating] = useState(false);
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

    const [selectedStockItems, setSelectedStockItems] = useState<Set<string>>(new Set());
    const [isBulkRemoveModalOpen, setIsBulkRemoveModalOpen] = useState(false);

    const [stockDrillDown, setStockDrillDown] = useState<any | null>(null);
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [viewingGR, setViewingGR] = useState<Order | null>(null);
    const [viewingGRItems, setViewingGRItems] = useState<any[]>([]);
    const [zoomLevel, setZoomLevel] = useState(100);
    const invoiceDocRef = useRef<HTMLDivElement>(null);

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

    const handleToggleSelectStock = (key: string) => {
        const newSelected = new Set(selectedStockItems);
        if (newSelected.has(key)) {
            newSelected.delete(key);
        } else {
            newSelected.add(key);
        }
        setSelectedStockItems(newSelected);
    };

    const handleSelectAllStock = () => {
        if (selectedStockItems.size === filteredStockRoom.length) {
            setSelectedStockItems(new Set());
        } else {
            const allKeys = filteredStockRoom.map(i => `${i.brand}-${i.model}-${i.quality}`.toUpperCase());
            setSelectedStockItems(new Set(allKeys));
        }
    };

    const handleBulkRemoveStock = async () => {
        if (selectedStockItems.size === 0) return;
        
        setIsRefreshing(true);
        try {
            const storageKey = 'apexflow_gr_physical_removals';
            const existingRemovalsStr = localStorage.getItem(storageKey);
            const removalsMap = existingRemovalsStr ? JSON.parse(existingRemovalsStr) : {};
            
            const now = new Date();
            const timestamp = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

            for (const key of selectedStockItems) {
                const item = aggregatedStockRoom.find(i => `${i.brand}-${i.model}-${i.quality}`.toUpperCase() === key);
                if (item) {
                    const qtyToRemove = item.quantity;
                    removalsMap[key] = (removalsMap[key] || 0) + qtyToRemove;
                    
                    const invItem = mainInventory.find(i => 
                        i.brand.toUpperCase() === item.brand.toUpperCase() && 
                        i.model.toUpperCase() === item.model.toUpperCase() &&
                        i.quality.toUpperCase() === item.quality.toUpperCase()
                    );

                    if (invItem) {
                        const newQty = 0;
                        await updateInventoryItemInDB({ ...invItem, quantity: newQty });
                        
                        await addInventoryLogToDB({
                            id: `gr-bulk-out-${Date.now()}-${invItem.id}`,
                            itemId: invItem.id,
                            modelName: `${invItem.brand} ${invItem.model}`,
                            shopName: 'Bulk Outward Shipment',
                            status: 'Removed',
                            totalQuantity: qtyToRemove,
                            itemCount: 1,
                            remarks: `Bulk removal from GR stock room`,
                            createdDate: timestamp,
                            currentStock: newQty,
                            instanceId: currentUser.instanceId
                        });
                    }
                }
            }

            localStorage.setItem(storageKey, JSON.stringify(removalsMap));
            showNotification(`${selectedStockItems.size} models cleared from stock room`, 'success');
            setSelectedStockItems(new Set());
            setIsBulkRemoveModalOpen(false);
            loadData();
        } catch (e) {
            showNotification('Bulk removal failed', 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadData();
        setIsRefreshing(false);
        showNotification('GR ledger synchronized');
    };

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 10, 200));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 10, 50));

    const handlePrintInvoice = () => {
        const printContent = invoiceDocRef.current;
        if (!printContent) return;
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>Print Invoice - ${viewingGR?.id}</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        @media print {
                            body { padding: 0; margin: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body class="bg-white">
                    <div class="p-8">
                        ${printContent.innerHTML}
                    </div>
                    <script>
                        window.onload = () => {
                            window.print();
                            window.close();
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleDownloadInvoice = () => {
        const element = invoiceDocRef.current;
        if (!element) return;
        
        if (!(window as any).html2pdf) {
            showNotification('PDF library not loaded. Please try again.');
            return;
        }

        const opt = {
            margin: 0.5,
            filename: `Invoice_${viewingGR?.id || 'GR'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        (window as any).html2pdf().set(opt).from(element).save();
    };

    const getCustomerPhone = (customerId: string) => {
        const customer = customers.find(c => c.id === customerId);
        return customer?.phone || 'N/A';
    };

    const handleViewGR = (gr: Order) => {
        const stored = localStorage.getItem(`apexflow_gr_items_${gr.id}`);
        const items = stored ? JSON.parse(stored) : [];
        setViewingGR(gr);
        setViewingGRItems(items);
        setInvoiceModalOpen(true);
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
            const existing = prev[itemId] || { qty: 0 };
            return { ...prev, [itemId]: { ...existing, price: sanitized } };
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
            orderMode: isCloudActive ? 'Online' : 'Offline',
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
            setIsCreating(false);
            showNotification(`GR Finalized: ₹${totalCreditValue.toFixed(1)} credited to ${selectedCustomer.name}`, 'success');
            loadData();
        } catch (err) {
            showNotification('Failed to sync GR to cloud', 'error');
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
            {isCreating ? (
                <div className="flex flex-col space-y-8 animate-in slide-in-from-right duration-500">
                    {/* CREATE GR PAGE VIEW */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[80vh] no-print">
                        <header className="bg-white border-b border-slate-100 shrink-0">
                            <div className="px-6 md:px-8 h-20 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <button 
                                        onClick={() => setIsCreating(false)}
                                        className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all active:scale-95"
                                    >
                                        <ArrowLeft size={20} strokeWidth={3} />
                                    </button>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-rose-600 text-white rounded-xl flex items-center justify-center shadow-md"><RotateCcw size={22} /></div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none">
                                                {step === 1 ? 'Select Client' : step === 2 ? 'Return Catalog' : 'Review Submission'}
                                            </h3>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                {selectedCustomer ? `CLIENT: ${selectedCustomer.name}` : 'Initializing Restoration Protocol'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="hidden md:flex items-center gap-2">
                                    {[1, 2, 3].map((s) => (
                                        <div 
                                            key={s}
                                            className={`w-2 h-2 rounded-full transition-all duration-300 ${step >= s ? 'bg-rose-600 w-6' : 'bg-slate-200'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </header>

                        {step === 1 ? (
                            <div className="flex-1 p-6 md:p-8 flex flex-col min-h-0 bg-slate-50/30">
                                <div className="relative mb-6 max-w-xl mx-auto w-full group">
                                    <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-rose-500 transition-colors" />
                                    <input 
                                        type="text" 
                                        placeholder="Find customer by name, phone or city..." 
                                        value={customerSearch} 
                                        onChange={e => setCustomerSearch(e.target.value)} 
                                        className="w-full pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-[12px] focus:ring-4 focus:ring-rose-50 transition-all shadow-sm" 
                                    />
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar max-w-3xl mx-auto w-full">
                                    {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).map(customer => (
                                        <button key={customer.id} onClick={() => { setSelectedCustomer(customer); setStep(2); }} className="w-full bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-between hover:border-rose-400 hover:translate-x-1 transition-all group shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-black text-[10px] group-hover:bg-rose-600 group-hover:text-white transition-all shadow-inner">{customer.name.charAt(0)}</div>
                                                <div className="text-left">
                                                    <p className="text-[11px] font-bold text-slate-800 uppercase tracking-tight leading-none">{customer.name}</p>
                                                    <p className="text-[8px] font-medium text-slate-400 uppercase tracking-widest mt-1">{customer.phone} | {customer.city}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest group-hover:text-rose-500">Select</span>
                                                <ChevronRight size={16} className="text-slate-200 group-hover:text-rose-500" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : step === 2 ? (
                            <div className="flex-1 flex flex-col min-h-0 bg-[#f8fafc] relative">
                                <div className="px-6 md:px-8 py-4 space-y-4 bg-white border-b border-slate-100 shadow-sm sticky top-0 z-30">
                                    <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 w-full max-w-xs mx-auto"><button onClick={() => setIsDirectMode(false)} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${!isDirectMode ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>Catalog</button><button onClick={() => setIsDirectMode(true)} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${isDirectMode ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>Direct</button></div>
                                    {!isDirectMode && (<div className="space-y-3 max-w-2xl mx-auto w-full"><div className="relative group"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-rose-500 transition-colors" /><input type="text" placeholder="FILTER MODELS, BRANDS..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-widest outline-none focus:bg-white focus:border-rose-500 transition-all shadow-inner" /></div><div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar justify-center">{tabs.map(tab => (<button key={tab.name} onClick={() => setActiveCategory(tab.name)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${activeCategory === tab.name ? 'bg-rose-600 text-white border-rose-600 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>{tab.name} ({tab.count})</button>))}</div></div>)}
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-1.5 custom-scrollbar pb-24">
                                    {!isDirectMode ? (
                                        <div className="flex flex-col gap-1.5 max-w-5xl mx-auto w-full">
                                            {/* List Header */}
                                            <div className="px-4 py-1.5 flex items-center text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">
                                                <div className="w-[20%]">Brand / Quality</div>
                                                <div className="flex-1">Model Identity</div>
                                                <div className="w-28 text-right pr-6">Rate (₹)</div>
                                                <div className="w-20 text-center">Qty</div>
                                            </div>
                                            
                                            {filteredInventoryForReturn.map(item => (
                                                <div key={item.id} className="bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between gap-3 group hover:border-rose-200 transition-all">
                                                    <div className="w-[20%] flex flex-col">
                                                        <span className="text-[8px] font-bold text-rose-600 uppercase tracking-tight leading-none mb-0.5">{item.brand}</span>
                                                        <span className="text-[7px] font-medium text-slate-400 uppercase tracking-widest leading-none">{item.quality}</span>
                                                    </div>
                                                    
                                                    <h3 className="flex-1 text-[10px] font-bold text-slate-800 uppercase leading-tight truncate pr-2">{item.model}</h3>
                                                    
                                                    <div className="w-28 flex justify-end pr-6">
                                                        <div className="relative w-20">
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 font-black text-[9px]">₹</span>
                                                            <input 
                                                                type="text" 
                                                                value={returnCart[item.id]?.price ?? item.price.toFixed(1)} 
                                                                onChange={e => handleUpdateReturnPrice(item.id, e.target.value)} 
                                                                onBlur={() => handlePriceBlur(item.id)} 
                                                                className="w-full pl-4 pr-1.5 py-1 bg-slate-50 border border-slate-100 rounded-md text-center text-[9px] font-black text-emerald-600 outline-none focus:bg-white focus:border-emerald-400 transition-all" 
                                                            />
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="w-20 flex justify-center">
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            value={returnCart[item.id]?.qty || ''} 
                                                            onChange={e => handleUpdateReturnQty(item.id, e.target.value, item.price)} 
                                                            placeholder="0" 
                                                            className="w-14 h-7 border rounded-lg text-center text-[10px] font-black outline-none transition-all bg-slate-50 border-slate-100 focus:bg-white focus:border-rose-500 shadow-inner" 
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="max-w-md mx-auto w-full p-6 bg-white rounded-3xl shadow-md border border-slate-100 space-y-4 mt-4">
                                            <div className="space-y-2">
                                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Credit Value (₹)</label>
                                                <div className="relative">
                                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-200 text-lg font-black">₹</span>
                                                    <input type="number" value={directAmount} onChange={e => setDirectAmount(e.target.value)} placeholder="0.00" className="w-full pl-12 pr-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xl font-black outline-none focus:bg-white focus:border-rose-400 transition-all shadow-inner text-indigo-600" autoFocus />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Remark / Reason</label>
                                                <textarea value={directRemarks} onChange={e => setDirectRemarks(e.target.value)} placeholder="ENTER REASON..." className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold uppercase outline-none focus:bg-white focus:border-rose-400 min-h-[80px] resize-none shadow-inner leading-relaxed" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {((!isDirectMode && cartItemIds.length > 0) || (isDirectMode && directAmount)) && (
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-40">
                                        <button 
                                            onClick={() => setStep(3)} 
                                            className="w-full bg-rose-600 text-white rounded-2xl p-2.5 shadow-lg flex items-center justify-between active:scale-95 transition-all group overflow-hidden"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white relative">
                                                    <RotateCcw size={16} strokeWidth={2.5} />
                                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-rose-600">
                                                        {!isDirectMode ? cartItemIds.filter(id => returnCart[id].qty > 0).length : '1'}
                                                    </span>
                                                </div>
                                                <div className="text-left">
                                                    <h4 className="text-[8px] font-black uppercase tracking-widest opacity-80 leading-none">TOTAL CREDIT</h4>
                                                    <p className="text-base font-black tracking-tight mt-0.5 italic">₹{totalCreditValue.toFixed(1)}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 pl-4 border-l border-white/20">
                                                <span className="text-[10px] font-black uppercase tracking-widest">REVIEW</span>
                                                <ArrowRight size={16} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 p-6 md:p-10 bg-[#f8fafc] overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
                                <div className="max-w-3xl mx-auto space-y-6">
                                    <button onClick={() => setStep(2)} className="flex items-center gap-2 text-slate-400 hover:text-rose-600 font-black text-[9px] uppercase tracking-widest transition-colors">
                                        <ArrowLeft size={16} strokeWidth={3} /> Adjust Selection
                                    </button>
                                    <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-slate-100">
                                        <div className="flex items-center gap-4 mb-8">
                                            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-inner">
                                                <ReceiptText size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">Submission Summary</h3>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Verification Step</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4 mb-10">
                                            {!isDirectMode ? (
                                                <div className="divide-y divide-slate-50 bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
                                                    {cartItemIds.filter(id => returnCart[id].qty > 0).map(id => { 
                                                        const i = mainInventory.find(x => x.id === id)!; 
                                                        return (
                                                            <div key={id} className="flex justify-between items-center py-3">
                                                                <div className="min-w-0 pr-4">
                                                                    <p className="text-[13px] font-black text-slate-800 uppercase truncate leading-none">{i.brand} {i.model}</p>
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1.5 tracking-widest">{i.quality}</p>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <div className="flex items-center justify-end gap-1.5">
                                                                        <span className="text-[10px] font-bold text-slate-400">{returnCart[id].qty} x</span>
                                                                        <span className="text-[11px] font-black text-emerald-600 tracking-tight">₹{parseFloat(returnCart[id].price).toFixed(1)}</span>
                                                                    </div>
                                                                    <p className="text-[14px] font-black text-emerald-600 mt-1 italic tracking-tight">₹{(returnCart[id].qty * parseFloat(returnCart[id].price || '0')).toFixed(1)}</p>
                                                                </div>
                                                            </div>
                                                        ); 
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="py-10 text-center space-y-4 bg-slate-50/50 rounded-3xl border border-slate-100">
                                                    <div className="inline-flex px-6 py-2 bg-rose-100 text-rose-600 border border-rose-200 rounded-full text-[9px] font-black uppercase tracking-widest">DIRECT CREDIT VOUCHER</div>
                                                    <p className="text-xl font-black text-slate-700 uppercase tracking-tight px-8">"{directRemarks || 'Voucher Adjustment Entry'}"</p>
                                                </div>
                                            )}
                                            <div className="pt-6 flex justify-between items-center border-t border-slate-200 border-dashed">
                                                <div>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Final Credit Allocation</span>
                                                </div>
                                                <span className="text-4xl font-black text-rose-600 italic tracking-tighter">₹{totalCreditValue.toFixed(1)}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                            <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner flex flex-col justify-center">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <UserCircle2 size={14} className="text-indigo-500" />
                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Customer</p>
                                                </div>
                                                <p className="text-sm font-black text-slate-900 uppercase leading-none">{selectedCustomer?.name}</p>
                                                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1.5">{selectedCustomer?.city}</p>
                                            </div>
                                            <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner flex flex-col justify-center items-center text-center">
                                                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center mb-2 shadow-sm">
                                                    <Activity size={16} className="text-rose-500" />
                                                </div>
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                                                <p className="text-[10px] font-black text-emerald-600 uppercase mt-0.5">Pending Sync</p>
                                            </div>
                                        </div>
                                        <button onClick={handleFinalizeGR} className="w-full py-3.5 bg-rose-600 text-white rounded-3xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-rose-100 hover:bg-rose-700 transition-all flex items-center justify-center gap-3 active:scale-[0.98]">
                                            Confirm and Authorize Credit <CheckCircle2 size={20} strokeWidth={3} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    {/* Header and Stats */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 no-print">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-rose-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-100 shrink-0">
                        <RotateCcw size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Goods Return Console</h2>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Inventory Restoration & Credit Adjustment</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="flex-1 lg:flex-none flex items-center gap-3 bg-white border border-slate-200 px-5 py-2.5 rounded-2xl shadow-sm">
                        <div className="w-7 h-7 bg-rose-50 text-rose-500 rounded-lg flex items-center justify-center">
                            <Package size={14} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Billed Units</p>
                            <p className="text-lg font-black text-slate-800 tracking-tight leading-none">{totalBilledUnits} Pcs</p>
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
                            setIsCreating(true);
                            setCustomerSearch('');
                            setItemSearch('');
                            setActiveCategory('All');
                        }}
                        className="px-6 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-md shadow-rose-100 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Plus size={14} strokeWidth={4} /> Create GR
                    </button>
                </div>
            </div>

            {/* Navigation & Search & Date Range */}
            <div className="flex flex-col xl:flex-row gap-4 items-center no-print">
                <div className="flex p-1 bg-slate-100 rounded-2xl w-full xl:w-auto">
                    <button 
                        onClick={() => { setActiveTab('history'); setCurrentPage(1); }}
                        className={`flex items-center gap-2 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'history' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <History size={14} /> History
                        {filteredHistory.length > 0 && (
                            <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[8px] font-black ${activeTab === 'history' ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-500'}`}>
                                {filteredHistory.length}
                            </span>
                        )}
                    </button>
                    <button 
                        onClick={() => { setActiveTab('inventory'); setCurrentPage(1); }}
                        className={`flex items-center gap-2 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'inventory' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <PackageSearch size={14} /> Stock Room
                        {filteredStockRoom.length > 0 && (
                            <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[8px] font-black ${activeTab === 'inventory' ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-500'}`}>
                                {filteredStockRoom.length}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-center flex-1 w-full">
                    <div className="relative flex-1 w-full group">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500 transition-colors">
                            <Search size={16} />
                        </div>
                        <input 
                            type="text" 
                            placeholder={`Search ${activeTab === 'history' ? 'client or id' : 'model or brand'}...`}
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-12 pr-12 py-3 bg-white border border-slate-200 rounded-2xl text-[12px] font-bold uppercase tracking-tight text-slate-800 outline-none focus:ring-4 focus:ring-rose-50/50 transition-all shadow-sm"
                        />
                    </div>

                    {activeTab === 'history' && (
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
                            <Calendar size={14} className="text-rose-500" />
                            <div className="flex items-center gap-2">
                                <input 
                                    type="date" 
                                    value={dateRange.start} 
                                    onChange={(e) => { setDateRange({...dateRange, start: e.target.value}); setCurrentPage(1); }}
                                    className="bg-transparent text-[10px] font-black uppercase outline-none text-slate-600"
                                />
                                <span className="text-slate-300 font-bold text-[9px]">TO</span>
                                <input 
                                    type="date" 
                                    value={dateRange.end} 
                                    onChange={(e) => { setDateRange({...dateRange, end: e.target.value}); setCurrentPage(1); }}
                                    className="bg-transparent text-[10px] font-black uppercase outline-none text-slate-600"
                                />
                            </div>
                        </div>
                    )}

                    <button onClick={handleRefresh} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-300 hover:text-rose-500 transition-all active:rotate-180 duration-500 shadow-sm">
                        <RefreshCw size={16} strokeWidth={2.5} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Main List Table */}
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col no-print max-h-[70vh]">
                {activeTab === 'inventory' && (
                    <div className="bg-rose-50 px-6 py-3 border-b border-rose-100 flex items-center justify-between animate-in slide-in-from-top duration-300">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 ${selectedStockItems.size > 0 ? 'bg-rose-600' : 'bg-slate-300'} text-white rounded-lg flex items-center justify-center shadow-sm transition-colors`}>
                                <CheckSquare size={16} strokeWidth={3} />
                            </div>
                            <span className={`text-[11px] font-black ${selectedStockItems.size > 0 ? 'text-rose-900' : 'text-slate-400'} uppercase tracking-widest transition-colors`}>
                                {selectedStockItems.size} Models Selected
                            </span>
                        </div>
                        <button 
                            onClick={() => setIsBulkRemoveModalOpen(true)}
                            disabled={selectedStockItems.size === 0}
                            className="px-4 py-2 bg-rose-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md shadow-rose-200 flex items-center gap-2 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none"
                        >
                            <Trash2 size={14} /> Bulk Remove All Stock
                        </button>
                    </div>
                )}
                <div className="overflow-x-auto custom-scrollbar overflow-y-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100 sticky top-0 z-10">
                                {activeTab === 'history' ? (
                                    <>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Return Details</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Customer Identity</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Value Impact</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 w-12">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedStockItems.size === filteredStockRoom.length && filteredStockRoom.length > 0}
                                                onChange={handleSelectAllStock}
                                                className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                            />
                                        </th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Stock Item</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Quality / Grade</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">In-Hand Stock</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={activeTab === 'history' ? 4 : 5} className="py-20 text-center"><Loader2 className="animate-spin text-rose-500 mx-auto" size={24} /></td></tr>
                            ) : paginatedData.length === 0 ? (
                                <tr><td colSpan={activeTab === 'history' ? 4 : 5} className="py-20 text-center"><ReceiptText size={40} className="text-slate-100 mx-auto mb-3" /></td></tr>
                            ) : paginatedData.map((item: any, idx: number) => {
                                const itemKey = activeTab === 'inventory' ? `${item.brand}-${item.model}-${item.quality}`.toUpperCase() : '';
                                return (
                                <tr key={activeTab === 'history' ? item.id : idx} className={`hover:bg-slate-50/50 transition-all group ${activeTab === 'inventory' && selectedStockItems.has(itemKey) ? 'bg-rose-50/30' : ''}`}>
                                    {activeTab === 'history' ? (
                                        <>
                                            <td className="px-6 py-3">
                                                <div className="flex flex-col">
                                                    <span className="text-[12px] font-black text-slate-900 uppercase tracking-tight leading-none mb-1">{item.orderTime}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ref: #{item.id.toString().slice(-10)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-black text-[10px]">{item.customerName.charAt(0)}</div>
                                                    <span className="text-[12px] font-black text-slate-700 uppercase tracking-tight">{item.customerName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <span className="text-base font-black text-emerald-600 tracking-tighter">+₹{Math.abs(item.totalAmount || 0).toFixed(1)}</span>
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <button 
                                                    onClick={() => handleViewGR(item)}
                                                    className="p-1.5 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                                                    title="View Invoice"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-3">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedStockItems.has(itemKey)}
                                                    onChange={() => handleToggleSelectStock(itemKey)}
                                                    className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                                />
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex flex-col">
                                                    <span className="text-[12px] font-black text-slate-900 uppercase tracking-tight leading-none mb-1">{item.model}</span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.brand} | {item.category}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className="inline-block px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-100 rounded-md text-[9px] font-black uppercase tracking-widest">{item.quality}</span>
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <button onClick={() => setStockDrillDown(item)} className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg font-black text-[12px] border border-rose-100 hover:bg-rose-600 hover:text-white transition-all flex items-center gap-1.5 mx-auto">
                                                    {item.quantity} <ChevronRight size={12} strokeWidth={3} />
                                                </button>
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <button onClick={() => handleInitiateRemove(item)} className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ml-auto">
                                                    <MinusCircle size={12} strokeWidth={3} /> Outward
                                                </button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* STOCK REMOVAL MODAL */}
            {isRemoveModalOpen && itemBeingRemoved && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-rose-50/30">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-md"><MinusCircle size={16} /></div>
                                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Physical Outward</h3>
                            </div>
                            <button onClick={() => setIsRemoveModalOpen(false)} className="w-6 h-6 rounded-full bg-white border border-slate-100 text-slate-400 flex items-center justify-center hover:text-rose-500 transition-colors"><X size={14} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Stock Node Identity</p>
                                <p className="text-[12px] font-black text-slate-800 uppercase tracking-tight leading-none">{itemBeingRemoved.brand} {itemBeingRemoved.model}</p>
                                <p className="text-xl font-black text-rose-600 tracking-tighter italic mt-1">In-Hand: {itemBeingRemoved.quantity} Pcs</p>
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Removal Quantity</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max={itemBeingRemoved.quantity} 
                                    value={removeQtyInput} 
                                    onChange={e => setRemoveQtyInput(e.target.value)} 
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-2xl font-black outline-none focus:bg-white focus:border-rose-400 transition-all shadow-inner" 
                                    autoFocus 
                                    placeholder="0" 
                                />
                            </div>
                            <p className="text-[8px] text-amber-600 font-bold uppercase text-center leading-relaxed px-2">Note: Removing items from stock room will NOT affect the customer's historical GR bill.</p>
                            <button 
                                onClick={handleConfirmRemoveQty} 
                                disabled={!removeQtyInput || parseInt(removeQtyInput) > itemBeingRemoved.quantity} 
                                className="w-full py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-100 active:scale-95 disabled:opacity-50 transition-all"
                            >
                                Authorize Outward Movement
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Remove Confirmation Modal */}
            {isBulkRemoveModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
                    <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                                <Trash2 size={40} strokeWidth={2.5} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Bulk Stock Removal</h3>
                            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest leading-relaxed">
                                You are about to remove ALL physical stock for <span className="text-rose-600">{selectedStockItems.size} selected models</span>. This action will update your inventory and create outward logs.
                            </p>
                        </div>
                        <div className="p-6 bg-slate-50 flex gap-3">
                            <button 
                                onClick={() => setIsBulkRemoveModalOpen(false)}
                                className="flex-1 py-4 bg-white border border-slate-200 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleBulkRemoveStock}
                                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95"
                            >
                                Confirm Removal
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* STOCK DRILL DOWN MODAL */}
            {stockDrillDown && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[180] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg h-[60vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-md"><Activity size={16} /></div>
                                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{stockDrillDown.model} - Audit</h3>
                            </div>
                            <button onClick={() => setStockDrillDown(null)} className="w-6 h-6 rounded-full bg-white border border-slate-100 text-slate-400 flex items-center justify-center hover:text-rose-500 transition-colors"><X size={14} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar bg-slate-50/30">
                            {stockDrillDown.history.map((entry: any, i: number) => (
                                <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm hover:border-rose-200 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 text-indigo-600 flex items-center justify-center font-black text-[9px]">{entry.customer.charAt(0)}</div>
                                        <div>
                                            <p className="text-[11px] font-black text-slate-800 uppercase leading-none">{entry.customer}</p>
                                            <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{entry.date}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-black text-rose-600">+{entry.qty}</span>
                                        <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Incoming</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-white border-t border-slate-100 flex justify-end shrink-0">
                            <button onClick={() => setStockDrillDown(null)} className="px-6 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 shadow-sm active:scale-95 hover:bg-white hover:border-rose-300 hover:text-rose-600 transition-all">
                                Close Audit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* INVOICE MODAL */}
            {invoiceModalOpen && viewingGR && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[300] flex items-center justify-center p-0 md:p-10 animate-in fade-in duration-300">
                    <div className="bg-white w-full h-full md:h-auto md:max-h-[95vh] lg:w-[95vw] lg:h-[90vh] rounded-none md:rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
                        {/* Header Title */}
                        <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-white shrink-0 no-print">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">Invoice Preview - Order : {viewingGR.id}</span>
                            <button onClick={() => setInvoiceModalOpen(false)} className="text-slate-400 hover:text-rose-600 transition-colors p-1">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Main PDF Viewer Shell */}
                        <div className="flex-1 flex flex-col bg-[#323639] overflow-hidden print:bg-white">
                            {/* Viewer Toolbar */}
                            <div className="h-12 bg-[#323639] px-4 flex items-center justify-between text-white shrink-0 shadow-md no-print">
                                <div className="flex items-center gap-4">
                                    <button className="p-1.5 hover:bg-white/10 rounded transition-colors"><MenuIcon size={18} /></button>
                                    <span className="text-xs font-medium opacity-80 max-w-[200px] truncate">Invoice_{viewingGR.id}.pdf</span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2 px-3 mr-4 border-x border-white/10">
                                        <span className="text-[11px] opacity-60">1 / 1</span>
                                    </div>
                                    <button onClick={handleZoomOut} className="p-1.5 hover:bg-white/10 rounded" title="Zoom Out"><ZoomOut size={16} /></button>
                                    <span className="text-xs font-bold px-2 w-12 text-center">{zoomLevel}%</span>
                                    <button onClick={handleZoomIn} className="p-1.5 hover:bg-white/10 rounded" title="Zoom In"><ZoomIn size={16} /></button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button className="p-2 hover:bg-white/10 rounded" title="Rotate"><RotateCw size={16} /></button>
                                    <button className="p-2 hover:bg-white/10 rounded" title="Full Screen"><Maximize2 size={16} /></button>
                                    <div className="w-px h-6 bg-white/10 mx-2"></div>
                                    <button onClick={handleDownloadInvoice} className="p-2 hover:bg-white/10 rounded" title="Download"><Download size={18} /></button>
                                    <button onClick={handlePrintInvoice} className="p-2 hover:bg-white/10 rounded" title="Print"><Printer size={18} /></button>
                                    <button className="p-2 hover:bg-white/10 rounded"><MoreVertical size={18} /></button>
                                </div>
                            </div>

                            {/* Viewer Workspace */}
                            <div className="flex-1 flex bg-[#525659] overflow-hidden print:bg-white">
                                {/* Main Document Canvas */}
                                <div className="flex-1 overflow-auto p-4 md:p-12 flex flex-col items-center custom-scrollbar print:p-0 print:overflow-visible">
                                    <div 
                                        ref={invoiceDocRef}
                                        style={{ 
                                            transform: `scale(${zoomLevel / 100})`, 
                                            transformOrigin: 'top center',
                                            marginBottom: zoomLevel > 100 ? `${(zoomLevel - 100) * 10}px` : '0'
                                        }}
                                        className="bg-white w-full max-w-[800px] shadow-2xl p-8 md:p-14 font-sans text-slate-900 flex flex-col h-fit transition-transform duration-200 ease-out print:shadow-none print:transform-none print:m-0 print:max-w-full"
                                    >
                                        <div className="text-center mb-10">
                                            <h1 className="text-3xl font-black tracking-tighter uppercase text-slate-900 leading-none">{superAdminName}</h1>
                                            <div className="h-1 w-24 bg-slate-900 mx-auto mt-3"></div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mt-4">Authorized Distribution Channel</p>
                                        </div>

                                        <div className="flex flex-col sm:flex-row justify-between items-start mb-12 text-[12px] gap-6">
                                            <div className="space-y-4">
                                                <div>
                                                    <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] mb-2">Customer:</p>
                                                    <p className="font-black text-xl text-slate-900 uppercase leading-none">{viewingGR.customerName}</p>
                                                    {getCustomerPhone(viewingGR.customerName) && <p className="text-slate-800 font-black mt-1 text-[11px] leading-tight">M: {getCustomerPhone(viewingGR.customerName)}</p>}
                                                </div>
                                            </div>
                                            <div className="text-left sm:text-right space-y-2">
                                                <div className="space-y-1.5">
                                                    <p className="font-bold text-slate-600 uppercase text-[11px]">Date : <span className="text-slate-900 font-black ml-2">{viewingGR.orderTime.split(' ')[0]}</span></p>
                                                    <p className="font-bold text-slate-600 uppercase text-[11px]">Invoice No : <span className="text-slate-900 font-black ml-2">#{viewingGR.id}</span></p>
                                                    <p className="font-bold text-slate-600 uppercase text-[11px]">Mode : <span className="text-slate-900 font-black ml-2">OFFLINE</span></p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1">
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr className="border-y-2 border-slate-900 bg-slate-50">
                                                        <th className="py-4 px-1 text-left text-[10px] font-black uppercase tracking-widest text-slate-900">Item Description</th>
                                                        <th className="py-4 px-1 text-center text-[10px] font-black uppercase tracking-widest text-slate-900 w-16">Qty</th>
                                                        <th className="py-4 px-1 text-center text-[10px] font-black uppercase tracking-widest text-slate-900 w-24">Rate</th>
                                                        <th className="py-4 px-1 text-right text-[10px] font-black uppercase tracking-widest text-slate-900 w-32">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {viewingGRItems.length > 0 ? viewingGRItems.map((entry: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-slate-50/50">
                                                            <td className="py-4 px-2">
                                                                <p className="text-[12px] font-black uppercase text-slate-800 leading-tight">{entry.item.brand} {entry.item.quality} {entry.item.model}</p>
                                                            </td>
                                                            <td className="py-4 px-2 text-center text-sm font-black text-slate-900">{entry.returnQty}</td>
                                                            <td className="py-4 px-2 text-center text-sm font-bold text-slate-700 italic">₹{entry.returnPrice.toFixed(1)}</td>
                                                            <td className="py-4 px-2 text-right text-sm font-black text-slate-900 tracking-tight">₹{(entry.returnQty * entry.returnPrice).toFixed(1)}</td>
                                                        </tr>
                                                    )) : (
                                                        <tr>
                                                            <td colSpan={4} className="py-12 text-center">
                                                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Direct Adjustment Voucher - No Items</p>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="border-t-2 border-slate-900">
                                                        <td colSpan={4} className="py-4 px-2">
                                                            <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest text-slate-900">
                                                                <div className="flex items-center gap-4">
                                                                    <span className="text-slate-400">Total Qty:</span>
                                                                    <span>{viewingGRItems.reduce((acc: number, curr: any) => acc + curr.returnQty, 0)} PCS</span>
                                                                </div>
                                                                <div className="flex items-center gap-4">
                                                                    <span className="text-slate-400">Grand Total:</span>
                                                                    <span className="text-lg italic">₹{Math.abs(viewingGR.totalAmount || 0).toFixed(1)}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>

                                        <div className="text-center mt-12 pt-8 border-t border-slate-100">
                                            <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-[0.2em]">Computer Generated Digital Document Node Signature.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Professional Footer Controls */}
                        <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end items-center gap-3 shrink-0 no-print">
                            <button 
                                onClick={handleDownloadInvoice}
                                className="px-8 py-3 bg-[#7c3aed] text-white rounded-xl font-black text-[11px] uppercase tracking-[0.15em] shadow-xl shadow-purple-200 hover:bg-[#6d28d9] transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Download size={16} /> Download Invoice
                            </button>
                            <button 
                                onClick={() => setInvoiceModalOpen(false)}
                                className="px-8 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl font-black text-[11px] uppercase tracking-[0.15em] hover:bg-slate-50 transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )}
</div>
);
};

export default CustomerGR;
