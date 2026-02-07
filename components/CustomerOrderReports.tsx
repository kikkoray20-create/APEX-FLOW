
import React, { useState, useMemo, useEffect } from 'react';
// Added ShoppingCart to the lucide-react import
import { Calendar, Search, Users, ShoppingBag, PackageCheck, Loader2, ChevronDown, ChevronLeft, ChevronRight, ShoppingCart, Clock } from 'lucide-react';
import { Order, OrderItem, Customer } from '../types';
import { fetchOrders, fetchCustomers } from '../services/db';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface CustomerStat {
    customerId: string;
    customerName: string;
    phone: string;
    orderCount: number;
    totalOrderQty: number;
    totalFulfilled: number;
    lastOrderDate: string;
}

const CustomerOrderReports: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState<Order[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    
    // Set default date range to last 1 month (approx 30 days)
    const [dateRange, setDateRange] = useState(() => {
        const end = new Date();
        const start = new Date();
        start.setMonth(end.getMonth() - 1); // Set to one month ago
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    });
    
    const [customerSearch, setCustomerSearch] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    useEffect(() => { loadData(); }, []);
    const loadData = async () => {
        setLoading(true);
        try {
            const [o, c] = await Promise.all([fetchOrders(), fetchCustomers()]);
            setOrders(o); 
            setCustomers(c);
        } finally {
            setLoading(false);
        }
    };

    // Helper to normalize any date string to DD/MM/YYYY for display
    const formatDateToDisplay = (dateStr: string) => {
        if (!dateStr) return '-';
        try {
            // Handle YYYY-MM-DD from input fields
            if (dateStr.includes('-')) {
                const parts = dateStr.split('-');
                if (parts.length === 3 && parts[0].length === 4) {
                    const [y, m, d] = parts;
                    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
                }
            }

            // Check if it's already DD/MM/YYYY HH:MM AM/PM
            const [datePart] = dateStr.split(' ');
            if (datePart.includes('/')) {
                const parts = datePart.split('/');
                if (parts.length === 3) {
                    const [d, m, y] = parts;
                    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
                }
            }
            
            // Fallback for other standard JS date strings
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            }
            return datePart;
        } catch (e) {
            return dateStr;
        }
    };

    const parseDateToComparable = (dateStr: string) => {
        try {
            const [datePart] = dateStr.split(' ');
            if (datePart.includes('/')) {
                const [d, m, y] = datePart.split('/');
                return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
            }
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? 0 : d.getTime();
        } catch (e) { return 0; }
    };

    const verifiedOrdersInRange = useMemo(() => {
        return orders.filter(o => {
            // Include only checked or dispatched orders for accurate fulfillment reporting
            if (!['checked', 'dispatched'].includes(o.status)) return false;
            try {
                const [datePart] = o.orderTime.split(' ');
                let orderDate = '';
                if (datePart.includes('/')) {
                    const [d, m, y] = datePart.split('/');
                    orderDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                } else {
                    const d = new Date(o.orderTime);
                    orderDate = d.toISOString().split('T')[0];
                }
                return orderDate >= dateRange.start && orderDate <= dateRange.end;
            } catch (e) { return false; }
        });
    }, [orders, dateRange]);

    const customerStatistics = useMemo(() => {
        const statsMap: Record<string, CustomerStat> = {};
        
        verifiedOrdersInRange.forEach(o => {
            const customerObj = customers.find(c => c.id === o.customerId || c.name === o.customerName);
            const key = o.customerName;
            const currentOrderDate = o.orderTime;

            if (!statsMap[key]) {
                statsMap[key] = { 
                    customerId: customerObj?.id || 'unknown', 
                    customerName: key, 
                    phone: customerObj?.phone || '-', 
                    orderCount: 0, 
                    totalOrderQty: 0, 
                    totalFulfilled: 0, 
                    lastOrderDate: currentOrderDate 
                };
            }
            
            const stat = statsMap[key];
            stat.orderCount += 1;

            // Track latest date
            const existingTime = parseDateToComparable(stat.lastOrderDate);
            const newTime = parseDateToComparable(currentOrderDate);
            if (newTime > existingTime) {
                stat.lastOrderDate = currentOrderDate;
            }

            // Priority 1: Use items array directly from the Order object (Cloud synced)
            let items: OrderItem[] = o.items || [];
            
            // Priority 2: Fallback to localStorage if items array is empty (Legacy support)
            if (items.length === 0) {
                const storedItems = localStorage.getItem(`apexflow_items_${o.id}`);
                if (storedItems) {
                    try {
                        items = JSON.parse(storedItems);
                    } catch (e) {
                        items = [];
                    }
                }
            }

            // Calculation logic:
            // Requested (Total Order Qty) = sum of item.orderQty
            // Fulfilled (Actual Sent Qty) = sum of item.fulfillQty
            items.forEach(item => { 
                stat.totalOrderQty += (Number(item.orderQty) || 0); 
                stat.totalFulfilled += (Number(item.fulfillQty) || 0); 
            });
        });

        return Object.values(statsMap)
            .filter(s => s.customerName.toLowerCase().includes(customerSearch.toLowerCase()) || s.phone.includes(customerSearch))
            .sort((a, b) => b.orderCount - a.orderCount);
    }, [verifiedOrdersInRange, customers, customerSearch]);

    // Pagination Logic
    const totalPages = Math.ceil(customerStatistics.length / itemsPerPage);
    const paginatedStats = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return customerStatistics.slice(startIndex, startIndex + itemsPerPage);
    }, [customerStatistics, currentPage, itemsPerPage]);

    const rangeStart = customerStatistics.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const rangeEnd = Math.min(currentPage * itemsPerPage, customerStatistics.length);

    const summary = useMemo(() => ({
        customers: new Set(verifiedOrdersInRange.map(o => o.customerName)).size,
        orders: verifiedOrdersInRange.length,
        totalRequested: customerStatistics.reduce((sum, s) => sum + s.totalOrderQty, 0),
        totalFulfilled: customerStatistics.reduce((sum, s) => sum + s.totalFulfilled, 0)
    }), [verifiedOrdersInRange, customerStatistics]);

    return (
        <div className="flex flex-col space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><Users size={24} /></div>
                    <div><h1 className="text-xl font-bold text-slate-800 tracking-tight">Customer Analytics</h1><p className="text-sm text-slate-500">Requested vs Fulfilled Performance Report</p></div>
                </div>
                <div className="flex items-center gap-3">
                    <Calendar size={18} className="text-indigo-400 shrink-0" />
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <input type="date" value={dateRange.start} onChange={(e) => { setDateRange({...dateRange, start: e.target.value}); setCurrentPage(1); }} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-bold outline-none focus:border-indigo-500 transition-colors" />
                            <span className="text-slate-300 font-bold text-[10px]">TO</span>
                            <input type="date" value={dateRange.end} onChange={(e) => { setDateRange({...dateRange, end: e.target.value}); setCurrentPage(1); }} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-bold outline-none focus:border-indigo-500 transition-colors" />
                        </div>
                        <p className="text-[9px] font-black text-indigo-500/60 uppercase tracking-widest mt-1 text-right">
                            {formatDateToDisplay(dateRange.start)} — {formatDateToDisplay(dateRange.end)}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Active Clients', value: summary.customers, icon: <Users size={20}/>, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Verified Orders', value: summary.orders, icon: <ShoppingBag size={20}/>, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Total Fulfilled', value: summary.totalFulfilled, icon: <PackageCheck size={20}/>, color: 'text-emerald-600', bg: 'bg-emerald-50' }
                ].map((s, i) => (
                    <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className={`w-12 h-12 ${s.bg} rounded-lg flex items-center justify-center ${s.color}`}>{s.icon}</div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{s.label}</p>
                            <h3 className="text-xl font-black text-slate-800 tracking-tighter">{s.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center gap-3 bg-slate-50/30">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Order Volume Statistics</h3>
                    <div className="relative w-full md:w-64">
                        <input type="text" placeholder="Filter by name..." value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setCurrentPage(1); }} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500 shadow-sm" />
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    </div>
                </div>
                
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b">
                            <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="px-6 py-4">Client Name</th>
                                <th className="px-4 py-4 text-center">Orders</th>
                                <th className="px-4 py-4 text-right">Requested (Customer)</th>
                                <th className="px-4 py-4 text-right">Fulfilled (Shipped)</th>
                                <th className="px-4 py-4 text-center">Last Order Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin text-indigo-500 mx-auto" size={24} /></td></tr>
                            ) : paginatedStats.length === 0 ? (
                                <tr><td colSpan={5} className="py-20 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No activity in this window</td></tr>
                            ) : (
                                paginatedStats.map((stat, idx) => {
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-black text-slate-800 text-sm uppercase">{stat.customerName}</td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-black">{stat.orderCount}</span>
                                            </td>
                                            <td className="px-4 py-4 text-right text-sm text-slate-600 font-medium">{stat.totalOrderQty} Units</td>
                                            <td className="px-4 py-4 text-right font-black text-emerald-600 text-sm">{stat.totalFulfilled} Units</td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                                    <Clock size={10} className="text-slate-400" />
                                                    {formatDateToDisplay(stat.lastOrderDate)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && customerStatistics.length > 0 && (
                    <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page Size</span>
                                <div className="relative">
                                    <select 
                                        value={itemsPerPage} 
                                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                        className="appearance-none bg-white border border-slate-200 rounded-xl px-3 py-1.5 pr-8 text-[11px] font-black text-slate-700 outline-none focus:border-indigo-500 shadow-sm cursor-pointer"
                                    >
                                        {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <span className="text-slate-900">{rangeStart}-{rangeEnd}</span> of <span className="text-slate-900">{customerStatistics.length}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-all active:scale-95"
                            >
                                <ChevronLeft size={16} strokeWidth={3} />
                            </button>
                            
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                                    let pageNum = i + 1;
                                    if (totalPages > 3 && currentPage > 2) {
                                        pageNum = currentPage - 2 + i + 1;
                                        if (pageNum > totalPages) pageNum = totalPages - (2 - i);
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all ${currentPage === pageNum ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            <button 
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-all active:scale-95"
                            >
                                <ChevronRight size={16} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerOrderReports;
