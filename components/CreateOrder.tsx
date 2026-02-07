
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Search, 
    ShoppingCart, 
    X,
    LogOut,
    Edit2,
    Loader2,
    Filter,
    ChevronDown,
    ChevronUp,
    Box
} from 'lucide-react';
import { Customer, InventoryItem, Order, OrderItem } from '../types';
import { MOCK_INVENTORY } from '../constants';
import { fetchInventory } from '../services/db';
import { useNotification } from '../context/NotificationContext';

interface CreateOrderProps {
    customer: Customer;
    onBack: () => void;
    onSubmitOrder: (order: Order, items: OrderItem[]) => void;
}

interface ProductItem extends InventoryItem {
    category: string;
}

const CreateOrder: React.FC<CreateOrderProps> = ({ customer, onBack, onSubmitOrder }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<Record<string, number>>({});
    const [activeTab, setActiveTab] = useState('All');
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [cargoName, setCargoName] = useState('');
    const { showNotification } = useNotification();

    const [inventory, setInventory] = useState<ProductItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const data = await fetchInventory();
                const formattedData: ProductItem[] = data.map((item: any) => ({
                    ...item,
                    category: item.category || 'APEXFLOW'
                }));
                
                if (formattedData.length === 0) {
                     const mockWithCategory = MOCK_INVENTORY.map((i: any) => ({...i, category: i.category || 'APEXFLOW'}));
                     setInventory(mockWithCategory);
                } else {
                     setInventory(formattedData);
                }
            } catch (error) {
                console.error("Failed to load inventory", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const tabs = useMemo(() => {
        const counts: Record<string, number> = {};
        inventory.forEach(i => {
            if (i.status !== 'Inactive') {
                counts[i.category] = (counts[i.category] || 0) + 1;
            }
        });
        const categories = Object.keys(counts).sort();
        const activeTotal = inventory.filter(i => i.status !== 'Inactive').length;
        return [{ name: 'All', count: activeTotal }, ...categories.map(c => ({ name: c, count: counts[c] }))];
    }, [inventory]);

    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            if (item.status === 'Inactive') return false;
            const matchesSearch = 
                item.model.toLowerCase().includes(searchTerm.toLowerCase()) || 
                item.brand.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesTab = activeTab === 'All' || item.category === activeTab;
            return matchesSearch && matchesTab;
        });
    }, [searchTerm, activeTab, inventory]);

    const handleQuantityChange = (itemId: string, val: string) => {
        const qty = parseInt(val) || 0;
        setCart(prev => {
            if (qty <= 0) {
                const { [itemId]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [itemId]: qty };
        });
    };

    const cartItemIds = Object.keys(cart);
    const totalQty: number = (Object.values(cart) as number[]).reduce((a: number, b: number) => a + (Number(b) || 0), 0);
    const totalItemsCount = cartItemIds.length;
    
    const totalAmount = cartItemIds.reduce((sum, itemId) => {
        const item = inventory.find(i => i.id === itemId);
        return sum + (item ? item.price * (cart[itemId] || 0) : 0);
    }, 0);

    const handlePlaceOrder = () => {
        if (totalQty === 0) return;
        const now = new Date();
        const orderId = `${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 899)}`;
        const dateStr = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

        const newOrder: Order = {
            id: orderId,
            customerId: customer.id, // FIXED: Embed permanent customer ID
            customerName: customer.name,
            customerSubtext: customer.city, // Use City for consistent profile ledger filtering
            orderTime: dateStr,
            warehouse: 'Main Warehouse',
            status: 'fresh',
            invoiceStatus: 'Pending',
            orderMode: 'Offline',
            cargoName: cargoName,
            totalAmount: totalAmount
        };

        const orderItems: OrderItem[] = cartItemIds.map((itemId, index) => {
            const item = inventory.find(i => i.id === itemId)!;
            return {
                id: `${orderId}-${index}`,
                brand: item.brand,
                quality: item.quality,
                category: item.category,
                model: item.model,
                orderQty: cart[itemId] || 0,
                displayPrice: item.price,
                fulfillQty: 0, 
                finalPrice: item.price
            };
        });

        onSubmitOrder(newOrder, orderItems);
        showNotification('Order placed successfully!');
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] min-h-screen relative animate-in fade-in duration-300">
            <div className="max-w-2xl mx-auto w-full px-4 pt-6 space-y-4">
                {/* Header Section */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Create Order</h1>
                        <p className="text-sm text-slate-400 font-medium">Customer: <span className="text-indigo-600 uppercase font-black">{customer.name}</span></p>
                    </div>
                    <button onClick={onBack} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-rose-500 transition-all shadow-sm active:scale-95">
                        <X size={20} strokeWidth={3} />
                    </button>
                </div>

                {/* Search Box */}
                <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                        <Search size={20} />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search model, brand or quality..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-12 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:border-blue-400 focus:ring-8 focus:ring-blue-500/5 transition-all text-sm font-bold shadow-sm"
                    />
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {tabs.map(tab => (
                        <button
                            key={tab.name}
                            onClick={() => setActiveTab(tab.name)}
                            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                                activeTab === tab.name 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {tab.name} {tab.name !== 'All' && `(${tab.count})`}
                        </button>
                    ))}
                </div>

                {/* Item List */}
                <div className="space-y-4 pb-32">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center gap-4">
                            <Loader2 className="animate-spin text-indigo-500" size={32} />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auditing Stock Levels...</p>
                        </div>
                    ) : filteredInventory.length === 0 ? (
                        <div className="py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
                            <Box size={40} className="text-slate-100 mx-auto mb-4" />
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Zero items matched query</p>
                        </div>
                    ) : filteredInventory.map(item => (
                        <div key={item.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                            <div className="flex-1 min-w-0 pr-4">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className="px-2 py-0.5 bg-orange-50 text-orange-600 border border-orange-100 rounded text-[9px] font-black uppercase tracking-widest">
                                        {item.brand}
                                    </span>
                                    <span className="px-2 py-0.5 bg-slate-50 text-slate-400 border border-slate-100 rounded text-[9px] font-black uppercase tracking-widest">
                                        {item.quality}
                                    </span>
                                    {/* Stock Indicator Badge */}
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                                        item.quantity > 50 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                        item.quantity > 0 ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                        'bg-rose-50 text-rose-600 border-rose-100'
                                    }`}>
                                        Stock: {item.quantity}
                                    </span>
                                </div>
                                <h3 className="text-[13px] font-black text-slate-800 uppercase leading-tight truncate">
                                    {item.model}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{item.category}</p>
                            </div>
                            
                            <div className="flex items-center gap-5">
                                <div className="text-right">
                                    <span className="text-[15px] font-black text-emerald-600 tracking-tighter">₹{item.price.toFixed(1)}</span>
                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-0.5">Rate/Unit</p>
                                </div>
                                <div className="w-24 relative">
                                    <input 
                                        type="number" 
                                        min="0"
                                        placeholder="0"
                                        value={cart[item.id] || ''}
                                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                        className={`w-full py-2.5 px-3 bg-slate-50 border-2 rounded-xl text-center text-sm font-black outline-none transition-all ${
                                            (cart[item.id] || 0) > 0 
                                            ? 'border-indigo-500 text-indigo-600 bg-white ring-8 ring-indigo-500/5' 
                                            : 'border-slate-100 text-slate-400 group-hover:border-slate-200'
                                        }`}
                                    />
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col opacity-40">
                                        <ChevronUp size={10} className="mb-0.5 cursor-pointer hover:text-indigo-600" onClick={() => handleQuantityChange(item.id, String((cart[item.id] || 0) + 1))} />
                                        <ChevronDown size={10} className="cursor-pointer hover:text-indigo-600" onClick={() => handleQuantityChange(item.id, String(Math.max(0, (cart[item.id] || 0) - 1)))} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Sticky Floating Cart... */}
            {Number(totalQty) > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 pointer-events-none no-print">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.1)] p-6 flex items-center justify-between pointer-events-auto animate-in slide-in-from-bottom-8">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                                    <ShoppingCart size={28} strokeWidth={2.5} />
                                </div>
                                <span className="absolute -top-2 -right-2 w-7 h-7 bg-rose-500 text-white text-[11px] font-black rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                                    {totalItemsCount}
                                </span>
                            </div>
                            <div>
                                <h4 className="text-base font-black text-slate-800 tracking-tighter uppercase">{totalItemsCount} Lines Selected</h4>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Quantity: {totalQty} Units</p>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => setIsConfirmModalOpen(true)}
                            className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-95"
                        >
                            Finalize
                        </button>
                    </div>
                </div>
            )}

            {/* Confirm Order Modal... */}
            {isConfirmModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                             <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                                    <Edit2 size={18} />
                                 </div>
                                 <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Finalizing Entry</h3>
                             </div>
                             <button onClick={() => setIsConfirmModalOpen(false)} className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:text-rose-500 transition-all shadow-sm">
                                 <X size={20} />
                             </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Assigned Cargo Name <span className="text-rose-500">*</span></label>
                                <input 
                                    type="text" 
                                    value={cargoName}
                                    onChange={(e) => setCargoName(e.target.value)}
                                    placeholder="e.g. BLUE DART / LOCAL TRUCK..."
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-400 outline-none transition-all text-sm font-bold uppercase tracking-tight shadow-inner"
                                    autoFocus
                                />
                            </div>

                            <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 shadow-inner">
                                <div className="max-h-40 overflow-y-auto space-y-3 pr-2 custom-scrollbar mb-6">
                                    {cartItemIds.map(itemId => {
                                        const item = inventory.find(i => i.id === itemId)!;
                                        return (
                                            <div key={itemId} className="flex justify-between items-center text-[11px]">
                                                <span className="font-black text-slate-700 uppercase truncate max-w-[160px] tracking-tight">
                                                    {item.brand} | {item.model}
                                                </span>
                                                <div className="flex items-center gap-4">
                                                    <span className="font-bold text-slate-400">{cart[itemId]}x</span>
                                                    <span className="font-black text-emerald-600">₹{(item.price * (cart[itemId] || 0)).toFixed(1)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="border-t border-slate-200 pt-5 space-y-2">
                                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <span>Items Summary</span>
                                        <span>{totalItemsCount} Lines</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <span>Total Quantity</span>
                                        <span>{totalQty} Units</span>
                                    </div>
                                    <div className="flex justify-between items-baseline pt-4 border-t border-slate-200 border-dashed mt-4">
                                        <span className="text-sm font-black uppercase text-slate-900 tracking-tighter">Total Bill Amount</span>
                                        <span className="text-3xl font-black text-emerald-600 tracking-tighter">₹{totalAmount.toFixed(1)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-8 pb-8 flex gap-4">
                            <button 
                                onClick={() => setIsConfirmModalOpen(false)}
                                className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all shadow-sm"
                            >
                                Discard
                            </button>
                            <button 
                                disabled={!cargoName.trim()}
                                onClick={handlePlaceOrder}
                                className="flex-[2] py-4 bg-indigo-600 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 transition-all active:scale-95 hover:bg-indigo-700"
                            >
                                Commit to Pipeline
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreateOrder;
