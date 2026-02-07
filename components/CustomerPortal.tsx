import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Search, X, Smartphone, ArrowRight, Loader2, Layers, ShoppingCart, 
    AlertCircle, ReceiptText, History, UserCircle, Phone, Building2, 
    Printer, FileDown, Share2, Info, ArrowLeft, Truck, Check, Lock,
    ChevronUp, ChevronDown, Package, Globe, CreditCard, ShieldCheck, KeyRound,
    Pencil, Users, User, Calendar, Filter, ChevronLeft, ChevronRight, Eye,
    RotateCcw, MessageSquare, RefreshCw, CalendarDays, LogOut, CheckCircle2,
    Database, Save, Unlock, ShoppingBag, FileText, CheckCircle, ZoomIn, ZoomOut, Maximize2
} from 'lucide-react';
import { InventoryItem, Customer, Order, OrderItem } from '../types';
import { fetchOrders, fetchCustomers, addOrderToDB, updateCustomerInDB, fetchUsers } from '../services/db';
import { useNotification } from '../context/NotificationContext';

type SimulationStep = 'login' | 'shop' | 'review' | 'success' | 'profile' | 'pin_verify';

interface CustomerPortalProps {
    storeName: string;
    status: 'Enabled' | 'Disabled';
    onClose?: () => void;
    inventory: InventoryItem[];
    allCustomers: Customer[];
    isExternal?: boolean;
    instanceId?: string;
    warehouse?: string;
}

const CustomerPortal: React.FC<CustomerPortalProps> = ({ 
    storeName, 
    status, 
    onClose, 
    inventory, 
    allCustomers: initialCustomers,
    isExternal = false,
    instanceId,
    warehouse
}) => {
    const { showNotification } = useNotification();
    const [step, setStep] = useState<SimulationStep>('login');
    const [mobile, setMobile] = useState('');
    const [cart, setCart] = useState<Record<string, number>>({});
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [cargoName, setCargoName] = useState('');
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [authenticatedCustomer, setAuthenticatedCustomer] = useState<Customer | null>(null);
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [lastOrderId, setLastOrderId] = useState('');
    const [allOrders, setAllOrders] = useState<Order[]>([]);
    const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [viewingTransaction, setViewingTransaction] = useState<Order | null>(null);
    const [isPinVerified, setIsPinVerified] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(100);

    // PIN States
    const [verificationPin, setVerificationPin] = useState('');
    const [pinError, setPinError] = useState(false);
    const [isEditingPin, setIsEditingPin] = useState(false);
    const [newPin, setNewPin] = useState('');
    const [isSavingPin, setIsSavingPin] = useState(false);

    // Ledger Filters and Default 4-Day Logic
    const getDefaultDates = () => {
        const todayDate = new Date();
        const start = new Date();
        start.setDate(todayDate.getDate() - 3); // Current day + 3 previous = 4 days
        
        return {
            today: todayDate.toISOString().split('T')[0],
            fourDaysAgo: start.toISOString().split('T')[0]
        };
    };

    const defaultDates = getDefaultDates();
    const [ledgerSearch, setLedgerSearch] = useState('');
    const [ledgerStatus, setLedgerStatus] = useState('ALL');
    const [ledgerStart, setLedgerStart] = useState(defaultDates.fourDaysAgo);
    const [ledgerEnd, setLedgerEnd] = useState(defaultDates.today);

    const parseOrderDateForFilter = (dateStr: string) => {
        try {
            const parts = dateStr.split(' ');
            const datePart = parts[0];
            const [d, m, y] = datePart.split('/').map(Number);
            
            let hours = 0;
            let minutes = 0;
            
            if (parts[1]) {
                const timeParts = parts[1].split(':');
                hours = parseInt(timeParts[0]);
                minutes = parseInt(timeParts[1]);
                if (parts[2] === 'PM' && hours < 12) hours += 12;
                if (parts[2] === 'AM' && hours === 12) hours = 0;
            }
            
            return new Date(y, m - 1, d, hours, minutes).getTime();
        } catch (e) { return 0; }
    };

    const getPortalDisplayStatus = (status: string, amount: number = 0) => {
        const s = status.toLowerCase();
        if (['fresh', 'assigned', 'packed', 'checked', 'dispatched'].includes(s)) return 'ORDER';
        if (s === 'return') return 'RETURN';
        if (s === 'payment') {
            return amount >= 0 ? 'PAYMENT' : 'DEDUCT';
        }
        return status.toUpperCase();
    };

    const loadPortalData = async (silent = true) => {
        if (!instanceId) return;
        setIsRefreshing(true);
        try {
            const [orders, custs] = await Promise.all([ fetchOrders(instanceId), fetchCustomers(instanceId) ]);
            setAllOrders(orders); setCustomers(custs);
            if (authenticatedCustomer) {
                const updatedMe = custs.find(c => c.id === authenticatedCustomer.id);
                if (updatedMe) setAuthenticatedCustomer(updatedMe);
            }
            if (!silent) showNotification('Portal refreshed');
        } finally { setIsRefreshing(false); }
    };

    useEffect(() => { if (instanceId) loadPortalData(true); }, [instanceId, step]);

    const totalQty = useMemo(() => (Object.values(cart) as number[]).reduce((a: number, b: number) => a + (Number(b) || 0), 0), [cart]);
    const totalAmount = useMemo(() => (Object.keys(cart) as string[]).reduce((sum: number, id: string) => {
        const item = inventory.find(i => i.id === id);
        return sum + (item ? item.price * (cart[id] || 0) : 0);
    }, 0), [cart, inventory]);

    const categories = useMemo(() => {
        const counts: Record<string, number> = {};
        inventory.forEach(i => { const cat = i.category || 'General'; counts[cat] = (counts[cat] || 0) + 1; });
        return [{ name: 'All', count: inventory.length }, ...Object.keys(counts).sort().map(c => ({ name: c, count: counts[c] }))];
    }, [inventory]);

    const handleLogin = async () => { 
        if (mobile.length !== 10) return; 
        if (status === 'Disabled') { setAuthError('STORE CURRENTLY OFFLINE'); return; }
        setIsAuthenticating(true); setAuthError(null); 
        try { 
            const matchedCustomer = (customers || []).find(c => c.phone.replace(/\D/g, '').endsWith(mobile)); 
            if (matchedCustomer) { 
                if (matchedCustomer.status !== 'Approved') setAuthError(`ACCOUNT ${matchedCustomer.status.toUpperCase()}`);
                else { 
                    setAuthenticatedCustomer(matchedCustomer); 
                    setStep('shop'); 
                    showNotification('Login successful!');
                }
            } else setAuthError('MOBILE NOT REGISTERED');
        } finally { setIsAuthenticating(false); }
    };

    const handleProfileTabClick = () => {
        if (step === 'profile' || step === 'pin_verify') {
            setStep('shop');
            return;
        }

        if (isPinVerified) {
            setStep('profile');
        } else {
            setVerificationPin('');
            setPinError(false);
            setStep('pin_verify');
        }
    };

    const handleVerifyPin = () => {
        if (!authenticatedCustomer) return;
        if (verificationPin === authenticatedCustomer.password) {
            setIsPinVerified(true);
            setStep('profile');
            setVerificationPin('');
            setPinError(false);
        } else {
            setPinError(true);
            setVerificationPin('');
            setTimeout(() => setPinError(false), 2000);
        }
    };

    const handleSaveNewPin = async () => {
        if (!authenticatedCustomer || newPin.length < 1) {
            showNotification('PIN cannot be empty', 'error');
            return;
        }
        setIsSavingPin(true);
        try {
            const updated = { ...authenticatedCustomer, password: newPin, instanceId: instanceId };
            await updateCustomerInDB(updated);
            setAuthenticatedCustomer(updated);
            setIsEditingPin(false);
            setNewPin('');
            showNotification('Access PIN Updated Successfully');
        } catch (e) {
            showNotification('Sync failed', 'error');
        } finally {
            setIsSavingPin(false);
        }
    };

    const handlePlaceOrder = async () => { 
        if (!authenticatedCustomer || totalQty === 0 || !cargoName.trim()) return; 
        setIsPlacingOrder(true); 
        const orderId = `ORD-${Date.now().toString().slice(-6)}`;
        const orderItems: OrderItem[] = Object.keys(cart).map(id => {
            const item = inventory.find(i => i.id === id)!;
            return { id: `${orderId}-${id}`, brand: item.brand, quality: item.quality, category: item.category || 'APEXFLOW', model: item.model, orderQty: cart[id], displayPrice: item.price, fulfillQty: 0, finalPrice: item.price };
        });
        const now = new Date();
        const timestamp = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
        const newOrder: Order = { 
            id: orderId, 
            customerId: authenticatedCustomer.id, 
            customerName: authenticatedCustomer.name, 
            customerSubtext: authenticatedCustomer.city, 
            orderTime: timestamp, 
            warehouse: warehouse || 'Online Portal', // Using the passed warehouse name
            status: 'fresh', 
            invoiceStatus: 'Pending', 
            orderMode: 'Online', 
            cargoName: cargoName.toUpperCase(), 
            totalAmount, 
            items: orderItems, 
            instanceId 
        }; 
        try { await addOrderToDB(newOrder); setAllOrders(prev => [newOrder, ...prev]); setLastOrderId(orderId); setStep('success'); } finally { setIsPlacingOrder(false); } 
    };

    const firmGroup = useMemo(() => authenticatedCustomer?.firmId ? customers.filter(c => c.firmId === authenticatedCustomer.firmId) : [authenticatedCustomer], [authenticatedCustomer, customers]);
    
    const totalSharedBalance = useMemo(() => {
        return firmGroup.reduce((sum: number, c) => sum + (Number(c?.balance) || 0), 0);
    }, [firmGroup]);

    const filteredLedger = useMemo(() => {
        return (allOrders || []).filter(o => {
            if (o.status === 'rejected') return false;
            const isMember = firmGroup.some(m => {
                if (!m) return false;
                if (o.customerId && o.customerId === m.id) return true;
                const dbName = (o.customerName || '').toLowerCase().trim();
                const memName = (m.name || '').toLowerCase().trim();
                if (dbName === memName) return true;
                const memAlias = (m.nickname || '').toLowerCase().trim();
                if (memAlias && dbName === memAlias) return true;
                return false;
            });
            if (!isMember) return false;
            if (ledgerSearch) {
                const term = ledgerSearch.toLowerCase().trim();
                const matchesId = o.id.toLowerCase().includes(term);
                const matchesDate = o.orderTime.toLowerCase().includes(term);
                if (!matchesId && !matchesDate) return false;
            }
            if (ledgerStatus !== 'ALL') {
                const s = o.status.toLowerCase();
                const amount = o.totalAmount || 0;
                if (ledgerStatus === 'RETURN') {
                    if (s !== 'return') return false;
                } else if (ledgerStatus === 'PAYMENT') {
                    if (!(s === 'payment' && amount >= 0)) return false;
                } else if (ledgerStatus === 'DEDUCT') {
                    if (!(s === 'payment' && amount < 0)) return false;
                } else if (ledgerStatus === 'ORDER') {
                    const orderStatuses = ['fresh', 'assigned', 'packed', 'checked', 'dispatched'];
                    if (!orderStatuses.includes(s)) return false;
                }
            }
            const txTime = parseOrderDateForFilter(o.orderTime);
            if (ledgerStart) {
                const start = new Date(ledgerStart).getTime();
                if (txTime < start) return false;
            }
            if (ledgerEnd) {
                const endDateTime = new Date(ledgerEnd);
                endDateTime.setHours(23, 59, 59, 999);
                if (txTime > endDateTime.getTime()) return false;
            }
            return true;
        }).sort((a, b) => parseOrderDateForFilter(b.orderTime) - parseOrderDateForFilter(a.orderTime));
    }, [allOrders, firmGroup, ledgerSearch, ledgerStatus, ledgerStart, ledgerEnd]);

    const handleRowClick = (order: Order) => {
        setZoomLevel(100);
        setViewingTransaction(order);
    };

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 10, 200));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 10, 50));
    const resetZoom = () => setZoomLevel(100);
    
    return (
        <div className={`fixed inset-0 bg-slate-50 z-[200] overflow-y-auto flex flex-col ${isExternal ? '' : 'admin-portal-view'}`}>
            <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto bg-white shadow-sm min-h-full">
                {step !== 'login' && step !== 'success' && (
                    <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
                        <div className="px-4 md:px-10 h-20 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0">
                                    <Layers size={22} className="md:w-6 md:h-6" strokeWidth={2.5} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <h2 className="text-sm md:text-lg font-black text-slate-800 uppercase tracking-tighter leading-none truncate">
                                        WELCOME : {authenticatedCustomer?.name || 'CUSTOMER'} 
                                    </h2>
                                    <p className="text-[8px] md:text-[10px] font-black text-indigo-500 uppercase mt-1 tracking-widest md:tracking-[0.2em] truncate">SECURE HUB NODE</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                                <button 
                                    onClick={handleProfileTabClick}
                                    title="Account Profile"
                                    className={`p-2.5 md:p-2.5 rounded-xl border transition-all ${step === 'profile' || step === 'pin_verify' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-100 hover:text-indigo-600'}`}
                                >
                                    <UserCircle size={22} className="md:w-5 md:h-5" strokeWidth={2.5} />
                                </button>
                                <button 
                                    onClick={() => loadPortalData(false)} 
                                    disabled={isRefreshing}
                                    title="Synchronize Database"
                                    className="p-2.5 md:p-2.5 bg-rose-50 text-rose-500 rounded-xl border border-rose-100 hover:bg-rose-100 transition-all shadow-sm active:scale-90"
                                >
                                    <RefreshCw size={22} className={`md:w-5 md:h-5 ${isRefreshing ? 'animate-spin' : ''}`} strokeWidth={2.5} />
                                </button>
                                {isExternal && onClose && (
                                    <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-slate-600 transition-all">
                                        <LogOut size={22} className="md:w-5 md:h-5" strokeWidth={2.5} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </header>
                )}

                <main className="flex-1 flex flex-col">
                    {step === 'login' && (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white"><div className="w-full max-sm"><div className="text-center mb-12"><div className="w-20 h-20 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white mx-auto mb-6 shadow-2xl"><Globe size={40} /></div><h2 className="text-3xl font-black text-slate-900 uppercase leading-none">{storeName}</h2><p className="text-slate-400 font-black text-[9px] uppercase mt-4 tracking-[0.4em]">Customer Link Authentication</p></div><div className="space-y-6"><div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Registered Mobile</label><div className="relative"><Smartphone size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" /><input type="tel" maxLength={10} value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, ''))} className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-bold text-lg" placeholder="10-Digit Mobile" /></div></div>{authError && (<div className="bg-rose-50 text-rose-600 p-4 rounded-2xl border border-rose-100 flex items-center gap-3"><AlertCircle size={20} /><p className="text-[10px] font-black uppercase">{authError}</p></div>)}<button onClick={handleLogin} disabled={isAuthenticating || mobile.length !== 10} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[12px] shadow-xl flex items-center justify-center gap-3">{isAuthenticating ? <Loader2 className="animate-spin" size={24} /> : <>Enter Store <ArrowRight size={20} /></>}</button></div></div></div>
                    )}

                    {step === 'pin_verify' && (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-[#f8fafc] animate-in fade-in duration-500">
                            <div className="w-full max-w-sm space-y-10">
                                <div className="text-center space-y-6">
                                    <div className={`w-24 h-24 rounded-[3rem] mx-auto flex items-center justify-center text-white shadow-2xl transition-all duration-500 ${pinError ? 'bg-rose-500 shadow-rose-200' : 'bg-indigo-600 shadow-indigo-100'}`}>
                                        <Lock size={40} strokeWidth={2.5} className={pinError ? 'animate-bounce' : ''} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">Unlock History</h3>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3">Private ledger access protocol</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            inputMode="numeric"
                                            value={verificationPin}
                                            onChange={e => {
                                                setVerificationPin(e.target.value.replace(/\D/g, ''));
                                                setPinError(false);
                                            }}
                                            onKeyDown={e => e.key === 'Enter' && handleVerifyPin()}
                                            className={`w-full h-24 bg-white border-2 rounded-[2rem] text-center text-5xl font-black outline-none transition-all ${pinError ? 'border-rose-500 ring-8 ring-rose-50' : 'border-indigo-100 focus:border-indigo-600 focus:ring-8 focus:ring-indigo-50 shadow-sm'}`}
                                            placeholder="•"
                                            autoFocus
                                        />
                                        {pinError && <p className="absolute -bottom-8 left-0 right-0 text-[10px] font-black text-rose-500 text-center uppercase tracking-widest animate-pulse">Identity Discrepancy: Invalid PIN</p>}
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <button 
                                            onClick={handleVerifyPin} 
                                            disabled={verificationPin.length < 1}
                                            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[12px] tracking-[0.2em] shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                                        >
                                            <Unlock size={18} /> Unlock Ledger
                                        </button>
                                        <button onClick={() => setStep('shop')} className="w-full py-5 bg-white border border-slate-200 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                                            <ArrowLeft size={16} /> Return to Store
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'shop' && (
                        <div className="flex-1 flex flex-col bg-white animate-in fade-in duration-500 pb-32">
                            <div className="px-6 md:px-10 py-5 space-y-4 sticky top-0 z-40 bg-white border-b border-slate-50 shadow-sm">
                                <div className="relative group">
                                    <input 
                                        type="text" 
                                        value={searchTerm} 
                                        onChange={e => setSearchTerm(e.target.value)} 
                                        placeholder="SEARCH MODELS..." 
                                        className="w-full pl-11 pr-6 py-3.5 bg-slate-50 border border-transparent rounded-xl text-[12px] font-black uppercase tracking-widest outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner" 
                                    />
                                    <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                </div>

                                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                    {categories.map(cat => (
                                        <button 
                                            key={cat.name} 
                                            onClick={() => setActiveCategory(cat.name)} 
                                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
                                                activeCategory === cat.name 
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                                                : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                                            }`}
                                        >
                                            {cat.name} ({cat.count})
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="px-4 md:px-10 mt-4 space-y-1.5">
                                {inventory.filter(i => (activeCategory === 'All' || i.category === activeCategory) && (i.model.toLowerCase().includes(searchTerm.toLowerCase()) || i.brand.toLowerCase().includes(searchTerm.toLowerCase()))).map(item => (
                                    <div key={item.id} className="bg-white p-3 md:p-4 rounded-2xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)] flex items-center justify-between gap-4 group hover:border-indigo-100 transition-all">
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest block mb-0.5">
                                                {item.brand} • {item.category}
                                            </span>
                                            <h3 className="text-[13px] md:text-[14px] font-black text-slate-900 uppercase leading-tight tracking-tight">
                                                {item.quality && `${item.quality} - `}{item.model}
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-4 md:gap-8 shrink-0">
                                            <div className="text-right">
                                                <span className="text-[14px] md:text-[16px] font-black text-emerald-600 tracking-tighter">₹{item.price.toFixed(1)}</span>
                                            </div>
                                            <div className="w-20 md:w-24 relative">
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    value={cart[item.id] || ''} 
                                                    onChange={(e) => { 
                                                        const v = parseInt(e.target.value) || 0; 
                                                        setCart(p => { 
                                                            if(v<=0) { const {[item.id]:_,...r}=p; return r; } 
                                                            return {...p,[item.id]:v}; 
                                                        }); 
                                                    }} 
                                                    placeholder="0" 
                                                    className={`w-full h-9 border rounded-lg text-center text-xs font-black outline-none transition-all ${
                                                        cart[item.id] 
                                                        ? 'border-indigo-500 text-indigo-600 bg-white shadow-sm ring-4 ring-indigo-50/50' 
                                                        : 'bg-slate-50 border-slate-100 placeholder-slate-300'
                                                    }`} 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {totalQty > 0 && (
                                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-xl z-50">
                                    <button 
                                        onClick={() => setStep('review')}
                                        className="w-full bg-indigo-600 text-white rounded-[2rem] p-6 shadow-2xl flex items-center justify-between active:scale-95 transition-all group overflow-hidden"
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white relative">
                                                <ShoppingCart size={24} strokeWidth={2.5} />
                                                <span className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 text-[10px] font-black rounded-full flex items-center justify-center border-2 border-indigo-600">
                                                    {Object.keys(cart).length}
                                                </span>
                                            </div>
                                            <div className="text-left">
                                                <h4 className="text-[12px] font-black uppercase tracking-widest opacity-80 leading-none">TOTAL: {totalQty} UNITS</h4>
                                                <p className="text-2xl font-black tracking-tighter mt-1">₹{totalAmount.toFixed(1)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 pl-8 border-l border-white/20">
                                            <span className="text-sm font-black uppercase tracking-[0.2em]">CHECKOUT</span>
                                            <ArrowRight size={20} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="flex-1 p-6 md:p-10 bg-[#f8fafc] animate-in fade-in duration-500"><div className="max-w-2xl mx-auto space-y-6"><button onClick={() => setStep('shop')} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-black text-[10px] uppercase tracking-widest"><ArrowLeft size={16} strokeWidth={3} /> Adjust Selection</button><div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-100"><h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-10">Confirm Transmission</h3><div className="space-y-4 mb-12">{Object.keys(cart).map(id => { const i = inventory.find(x => x.id === id)!; return (<div key={id} className="flex justify-between items-center py-4 border-b border-slate-50"><div className="min-w-0 pr-4"><p className="text-[14px] font-black text-slate-800 uppercase truncate leading-none">{i.brand} {i.model}</p><p className="text-[10px] font-bold text-slate-400 uppercase mt-1.5 tracking-widest">{i.quality}</p></div><div className="text-right whitespace-nowrap"><p className="text-[13px] font-black text-slate-900 leading-none">{cart[id]} x ₹{i.price.toFixed(1)}</p><p className="text-[14px] font-black text-emerald-600 mt-1 italic">₹{(cart[id]*i.price).toFixed(1)}</p></div></div>); })}<div className="pt-8 flex justify-between items-baseline"><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Estimated Credit Impact</span><span className="text-4xl font-black text-indigo-600 italic tracking-tighter">₹{totalAmount.toFixed(1)}</span></div></div><div className="space-y-3"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Cargo / Transport Name</label><input type="text" value={cargoName} onChange={e => setCargoName(e.target.value)} placeholder="e.g. BLUE DART / LOCAL TRUCK..." className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-black text-sm uppercase outline-none focus:bg-white focus:border-indigo-600 shadow-inner" /></div><button onClick={handlePlaceOrder} disabled={!cargoName.trim() || isPlacingOrder} className="w-full mt-12 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase text-[13px] tracking-[0.2em] shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">{isPlacingOrder ? <Loader2 className="animate-spin" size={24} /> : <>Commit to Picking Core <ArrowRight size={20} strokeWidth={3} /></>}</button></div></div></div>
                    )}

                    {step === 'success' && (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white animate-in zoom-in-95 duration-500"><div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center text-white mb-8 shadow-2xl shadow-emerald-100 animate-bounce"><Check size={48} strokeWidth={4} /></div><h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-2">Order Confirmed</h2><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-8">Ref ID: #{lastOrderId}</p><div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100 text-center mb-12 w-full max-sm shadow-inner"><p className="text-slate-600 font-bold text-sm uppercase leading-relaxed tracking-tight">Your order has been successfully injected into our processing node. An agent will begin verification shortly.</p></div><button onClick={() => { setCart({}); setCargoName(''); setStep('shop'); }} className="px-16 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-[12px] uppercase tracking-[0.3em] shadow-xl hover:bg-indigo-700 transition-all">Return to Catalog</button></div>
                    )}

                    {step === 'profile' && authenticatedCustomer && (
                        <div className="flex-1 p-4 md:p-10 bg-[#f8fafc] animate-in fade-in duration-500">
                            <div className="max-w-4xl mx-auto space-y-6 md:space-y-10">
                                
                                {/* HERO CREDIT CARD */}
                                <div className="bg-[#0f172a] p-8 md:p-14 rounded-[2.5rem] md:rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden group">
                                    <div className="relative z-10 space-y-6 md:space-y-10">
                                        <div>
                                            <p className="text-indigo-400 text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] mb-3 md:mb-4">Total Combined Credit</p>
                                            <h3 className="text-5xl md:text-7xl font-black tracking-tighter italic">₹{totalSharedBalance.toFixed(1)}</h3>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-lg md:text-xl font-black uppercase tracking-tight leading-none">{authenticatedCustomer.name}</p>
                                                <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">{authenticatedCustomer.city}</p>
                                            </div>
                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 shadow-xl">
                                                <ShieldCheck size={24} className="text-emerald-500" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[120%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-1000"></div>
                                    <div className="absolute bottom-[-30%] left-[-10%] w-[50%] h-[100%] bg-blue-50/5 rounded-full blur-[100px] pointer-events-none"></div>
                                </div>

                                {/* ACCOUNT PROFILE SECTION */}
                                <div className="bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-sm border border-slate-100 relative overflow-hidden">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 md:mb-10">
                                        <h3 className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                            <UserCircle size={20} className="text-indigo-600" /> Account Profile
                                        </h3>
                                        <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                            <CheckCircle2 size={12} strokeWidth={3} /> Verified Session
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 md:gap-y-10">
                                        <div>
                                            <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Customer Name</p>
                                            <p className="text-sm md:text-[16px] font-black text-slate-900 uppercase tracking-tight">{authenticatedCustomer.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Contact Number</p>
                                            <p className="text-sm md:text-[16px] font-black text-slate-900 uppercase tracking-tight">{authenticatedCustomer.phone}</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Business Firm</p>
                                            <p className="text-sm md:text-[16px] font-black text-indigo-600 uppercase tracking-tight flex items-center gap-2">
                                                <Building2 size={14}/> {authenticatedCustomer.firmId || 'Individual Ledger'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Secure Access Pin</p>
                                            <div className="flex items-center gap-3">
                                                {isEditingPin ? (
                                                    <div className="flex items-center gap-2 animate-in fade-in zoom-in-95">
                                                        <input 
                                                            type="text" 
                                                            value={newPin} 
                                                            onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} 
                                                            className="w-24 h-10 border-2 border-indigo-200 rounded-xl text-center font-black outline-none focus:border-indigo-600"
                                                            placeholder="PIN"
                                                            autoFocus
                                                        />
                                                        <button 
                                                            onClick={handleSaveNewPin} 
                                                            disabled={isSavingPin || newPin.length < 1}
                                                            className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
                                                        >
                                                            {isSavingPin ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                        </button>
                                                        <button 
                                                            onClick={() => { setIsEditingPin(false); setNewPin(''); }} 
                                                            className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-sm md:text-[16px] font-black text-slate-900 tracking-wider">
                                                            {authenticatedCustomer.password?.split('').map(() => '•').join('')}
                                                        </p>
                                                        <button 
                                                            onClick={() => { setIsEditingPin(true); setNewPin(authenticatedCustomer.password || ''); }}
                                                            className="p-1.5 rounded-lg bg-slate-50 text-slate-300 hover:text-indigo-600 transition-all"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* LEDGER ACTIVITY HISTORY */}
                                <div className="space-y-4 md:space-y-6">
                                    <h3 className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-3 ml-2">
                                        <RotateCcw size={18} className="text-indigo-600" /> Ledger Activity History
                                    </h3>

                                    <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 border border-slate-200 shadow-sm">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                                            <div className="space-y-2.5">
                                                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Search Date/ID</label>
                                                <div className="relative group">
                                                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                                    <input type="text" value={ledgerSearch} onChange={e => setLedgerSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all font-bold text-xs md:text-sm" placeholder="e.g. 15/05..." />
                                                </div>
                                            </div>
                                            <div className="space-y-2.5">
                                                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Filter</label>
                                                <div className="relative">
                                                    <Filter size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                                    <select value={ledgerStatus} onChange={e => setLedgerStatus(e.target.value)} className="w-full pl-12 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl outline-none appearance-none font-bold text-xs md:text-sm cursor-pointer hover:bg-slate-100 transition-all">
                                                        <option value="ALL">ALL</option>
                                                        <option value="ORDER">ORDER</option>
                                                        <option value="PAYMENT">PAYMENT</option>
                                                        <option value="DEDUCT">DEDUCT</option>
                                                        <option value="RETURN">RETURN</option>
                                                    </select>
                                                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            <div className="space-y-2.5">
                                                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Range: Start</label>
                                                <div className="relative">
                                                    <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                                    <input type="date" value={ledgerStart} onChange={e => setLedgerStart(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl outline-none font-bold text-[10px] md:text-xs uppercase" />
                                                </div>
                                            </div>
                                            <div className="space-y-2.5">
                                                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Range: End</label>
                                                <div className="relative">
                                                    <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                                    <input type="date" value={ledgerEnd} onChange={e => setLedgerEnd(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl outline-none font-bold text-[10px] md:text-xs uppercase" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-[1.5rem] md:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
                                        <div className="overflow-x-auto">
                                            {filteredLedger.length === 0 ? (
                                                <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-40 grayscale">
                                                    <Database size={64} className="text-slate-200 mb-6" />
                                                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">No activity in this period</p>
                                                </div>
                                            ) : (
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-slate-50 border-b border-slate-100 text-[9px] md:text-[10px] uppercase text-slate-400 font-black tracking-widest">
                                                            <th className="px-6 md:px-10 py-6">Transaction Info</th>
                                                            <th className="px-6 md:px-10 py-6 text-right">Adjustment Value</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {filteredLedger.map(o => { 
                                                            const amount = o.totalAmount || 0;
                                                            const s = o.status.toLowerCase();
                                                            const isCr = s === 'return' || (s === 'payment' && amount >= 0);
                                                            const displayStatusText = getPortalDisplayStatus(o.status, amount);
                                                            const displayDate = (o.orderTime || '').split(' ')[0];
                                                            
                                                            return (
                                                                <tr key={o.id} onClick={() => handleRowClick(o)} className="hover:bg-slate-50/50 transition-colors cursor-pointer group">
                                                                    <td className="px-6 md:px-10 py-5">
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <span className="font-black text-slate-900 text-[12px] md:text-[13px] tracking-tight group-hover:text-indigo-600 transition-colors">{displayDate}</span>
                                                                            <span className="font-bold text-slate-400 text-[9px] md:text-[10px] uppercase tracking-wider">#{o.id.slice(-10)}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 md:px-10 py-5">
                                                                        <div className="flex flex-col items-end gap-1.5">
                                                                            <span className={`font-black text-[13px] md:text-[15px] tracking-tighter ${isCr ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                                {isCr ? '+' : '-'}₹{Math.abs(amount).toFixed(1)}
                                                                            </span>
                                                                            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border tracking-widest ${
                                                                                displayStatusText === 'RETURN' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                                                                displayStatusText === 'PAYMENT' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                                displayStatusText === 'DEDUCT' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                                                'bg-indigo-50 text-indigo-600 border-indigo-100'
                                                                            }`}>
                                                                                {displayStatusText}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ); 
                                                        })}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* PROFESSIONAL INVOICE MODAL FOR CUSTOMER */}
            {viewingTransaction && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[300] flex items-center justify-center p-2 md:p-4 overflow-y-auto animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 no-print">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                    {viewingTransaction.status === 'Payment' ? 'Voucher' : (viewingTransaction.status === 'Return' ? 'Credit Note' : 'Order Summary')} - #{viewingTransaction.id.toString().slice(-8)}
                                </span>
                                <div className="h-4 w-px bg-slate-300 mx-2"></div>
                                <div className="flex items-center gap-1.5">
                                    <button onClick={handleZoomOut} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors" title="Zoom Out"><ZoomOut size={16} /></button>
                                    <button onClick={resetZoom} className="px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-200 rounded transition-colors">{zoomLevel}%</button>
                                    <button onClick={handleZoomIn} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors" title="Zoom In"><ZoomIn size={16} /></button>
                                </div>
                            </div>
                            <button onClick={() => setViewingTransaction(null)} className="text-slate-400 hover:text-rose-600 transition-colors p-1">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 p-2 md:p-6 bg-gray-100 flex justify-center no-scrollbar overflow-y-auto custom-scrollbar">
                            <div 
                                style={{ 
                                    transform: `scale(${zoomLevel / 100})`, 
                                    transformOrigin: 'top center',
                                    marginBottom: zoomLevel > 100 ? `${(zoomLevel - 100) * 10}px` : '0'
                                }}
                                className="bg-white w-full max-w-[850px] min-h-0 shadow-sm p-4 md:p-12 border border-slate-200 font-sans text-slate-900 flex flex-col transition-transform duration-200 ease-out"
                            >
                                <div className="text-center mb-6 md:mb-10">
                                    <h1 className="text-xl md:text-3xl font-black tracking-tighter uppercase text-slate-900 leading-tight">{storeName}</h1>
                                    <div className="h-0.5 md:h-1 w-16 md:w-24 bg-slate-900 mx-auto mt-2"></div>
                                    <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3">Official Transaction Copy</p>
                                </div>

                                <div className="flex flex-col sm:flex-row justify-between items-start mb-6 md:mb-10 text-[10px] md:text-[12px] gap-4 md:gap-6">
                                    <div className="space-y-1 md:space-y-2">
                                        <p className="text-slate-400 font-black uppercase tracking-widest text-[8px] md:text-[9px]">Bill To</p>
                                        <div>
                                            <p className="font-black text-base md:text-xl text-slate-900 uppercase tracking-tight">{viewingTransaction.customerName}</p>
                                            <p className="text-slate-500 font-bold uppercase text-[9px] md:text-[11px] mt-1">{viewingTransaction.customerSubtext}</p>
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right space-y-1">
                                        <p className="text-slate-400 font-black uppercase tracking-widest text-[8px] md:text-[9px]">Details</p>
                                        <p className="font-bold text-slate-600 uppercase text-[10px] md:text-[12px]">Date : <span className="text-slate-900 font-black">{viewingTransaction.orderTime.split(' ')[0]}</span></p>
                                        <p className="font-bold text-slate-600 uppercase text-[10px] md:text-[12px]">Ref : <span className="text-slate-900 font-black">#{viewingTransaction.id.toString().slice(-10)}</span></p>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-x-auto overflow-y-hidden">
                                    <table className="w-full border-collapse min-w-[320px]">
                                        <thead>
                                            <tr className="border-y border-slate-900">
                                                <th className="py-2 md:py-4 px-1 text-left text-[9px] md:text-[11px] font-black uppercase tracking-widest text-slate-900 min-w-[140px] sm:min-w-[400px]">Description</th>
                                                {viewingTransaction.items && viewingTransaction.items.length > 0 && (
                                                    <>
                                                        <th className="py-2 md:py-4 px-1 text-center text-[9px] md:text-[11px] font-black uppercase tracking-widest text-slate-900 w-10 md:w-16">Qty</th>
                                                        <th className="py-2 md:py-4 px-1 text-center text-[9px] md:text-[11px] font-black uppercase tracking-widest text-slate-900 w-20 md:w-28">Rate</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {viewingTransaction.items && viewingTransaction.items.length > 0 ? (
                                                viewingTransaction.items.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50">
                                                        <td className="py-2 md:py-4 px-1 text-[11px] md:text-[13px] font-bold uppercase text-slate-800 leading-tight min-w-[140px] sm:min-w-[400px]">
                                                            {item.brand} {item.quality} {item.model}
                                                        </td>
                                                        <td className="py-2 md:py-4 px-1 text-center text-[11px] md:text-[14px] font-black text-slate-900">{item.fulfillQty || item.orderQty}</td>
                                                        <td className="py-2 md:py-4 px-1 text-center text-[11px] md:text-[14px] font-bold text-slate-700">₹{item.finalPrice.toFixed(1)}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td className="py-6 md:py-10 px-1 text-[11px] md:text-[13px] font-black uppercase text-slate-800 min-w-[140px] sm:min-w-[400px]">
                                                        {viewingTransaction.status === 'Payment' ? 'Account Adjustment' : 'General Transaction'}
                                                        <p className="text-[8px] md:text-[10px] font-bold text-slate-400 mt-1 md:mt-2 uppercase italic tracking-widest">Type: {viewingTransaction.status}</p>
                                                    </td>
                                                    <td className="py-6 md:py-10 px-1 text-right text-[12px] md:text-[16px] font-black text-slate-900">₹{Math.abs(viewingTransaction.totalAmount || 0).toFixed(1)}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot>
                                            {viewingTransaction.items && viewingTransaction.items.length > 0 && (
                                                <tr className="border-t border-slate-200 bg-slate-50/10">
                                                    <td className="py-2 md:py-4 px-1 text-[10px] md:text-[12px] font-black uppercase tracking-widest text-slate-500 min-w-[140px] sm:min-w-[400px]">Total Quantity</td>
                                                    <td className="py-2 md:py-4 px-1 text-center text-[12px] md:text-[16px] font-black text-slate-900">
                                                        {viewingTransaction.items.reduce((sum, item) => sum + (item.fulfillQty || item.orderQty), 0)}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            )}
                                            <tr className="border-t-2 border-slate-900 bg-slate-50/30">
                                                <td colSpan={viewingTransaction.items && viewingTransaction.items.length > 0 ? 2 : 1} className="py-3 md:py-5 px-1 text-[10px] md:text-[12px] font-black uppercase tracking-widest text-slate-900 min-w-[140px] sm:min-w-[400px]">Net Impact</td>
                                                <td className="py-3 md:py-5 px-1 text-right text-[16px] md:text-[22px] font-black text-indigo-600 tracking-tighter whitespace-nowrap">
                                                    {(viewingTransaction.status.toLowerCase() === 'return' || (viewingTransaction.status.toLowerCase() === 'payment' && (viewingTransaction.totalAmount || 0) >= 0)) ? '+' : '-'}
                                                    ₹{Math.abs(viewingTransaction.totalAmount || 0).toFixed(1)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <div className="mt-6 md:mt-10 p-3 md:p-5 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                                    <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Info size={11}/> Order Status</p>
                                    <p className="text-[10px] md:text-[12px] font-bold text-slate-600 uppercase tracking-tight leading-relaxed">
                                        {getPortalDisplayStatus(viewingTransaction.status, viewingTransaction.totalAmount || 0)} - Verified via Network Node
                                    </p>
                                </div>

                                <div className="text-center mt-6 md:mt-10 pt-4 md:pt-6 border-t border-slate-100">
                                    <h3 className="text-sm md:text-lg font-black tracking-tight text-slate-800 uppercase">Thank You</h3>
                                    <p className="text-[8px] md:text-[9px] font-black text-slate-400 mt-1 uppercase tracking-widest">Certified Digital Copy.</p>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-wrap justify-end gap-3 no-print">
                            <button onClick={() => setViewingTransaction(null)} className="px-8 py-3 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl font-black text-[11px] uppercase transition-all">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

function showNotificationHook() {
    try { return useNotification(); } catch (e) { return { showNotification: (m: string) => alert(m) }; }
}

export default CustomerPortal;