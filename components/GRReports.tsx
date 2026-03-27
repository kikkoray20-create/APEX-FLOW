
import React, { useState, useEffect, useMemo } from 'react';
import { 
    FileText, 
    Download, 
    Search, 
    Calendar, 
    Loader2, 
    RefreshCw,
    UserCircle2,
    Package,
    ArrowRight
} from 'lucide-react';
import { fetchOrders, fetchCustomers, fetchInventory } from '../services/db';
import { Order, Customer, InventoryItem } from '../types';
import * as XLSX from 'xlsx';
import { useNotification } from '../context/NotificationContext';

interface GRReportsProps {
    currentUser: any;
}

const GRReports: React.FC<GRReportsProps> = ({ currentUser }) => {
    const [loading, setLoading] = useState(true);
    const [grs, setGrs] = useState<Order[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const { showNotification } = useNotification();

    const [dateRange, setDateRange] = useState(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30); // Default to last 30 days
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [allOrders, allCustomers, allInventory] = await Promise.all([
                fetchOrders(currentUser.instanceId),
                fetchCustomers(currentUser.instanceId),
                fetchInventory(currentUser.instanceId)
            ]);
            setGrs(allOrders.filter(o => o.status === 'Return'));
            setCustomers(allCustomers);
            setInventory(allInventory);
        } catch (error) {
            console.error("Failed to load GR report data", error);
            showNotification("Failed to load report data", "error");
        } finally {
            setLoading(false);
        }
    };

    const parseOrderDate = (dateStr: string) => {
        try {
            const [dPart] = dateStr.split(' ');
            const [d, m, y] = dPart.split('/').map(Number);
            return new Date(y, m - 1, d).toISOString().split('T')[0];
        } catch (e) { return ''; }
    };

    const filteredGRs = useMemo(() => {
        return grs.filter(o => {
            const orderDate = parseOrderDate(o.orderTime);
            return orderDate >= dateRange.start && orderDate <= dateRange.end;
        });
    }, [grs, dateRange]);

    const exportCustomerReport = () => {
        setIsExporting(true);
        try {
            // Aggregate GR data by customer
            const customerStats: Record<string, any> = {};
            
            filteredGRs.forEach(gr => {
                const key = gr.customerId || gr.customerName;
                if (!customerStats[key]) {
                    customerStats[key] = {
                        'Customer Name': gr.customerName,
                        'City/Address': gr.customerSubtext || '',
                        'Total GR Count': 0,
                        'Total Return Value': 0,
                        'Total Units Returned': 0
                    };
                }
                customerStats[key]['Total GR Count'] += 1;
                customerStats[key]['Total Return Value'] += (gr.totalAmount || 0);
                
                if (gr.items) {
                    gr.items.forEach((item: any) => {
                        customerStats[key]['Total Units Returned'] += (item.returnQty || item.fulfillQty || 0);
                    });
                }
            });

            const data = Object.values(customerStats);
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Customer GR Report");
            
            // Auto-size columns
            const maxWidths = data.reduce((acc: any, row: any) => {
                Object.keys(row).forEach((key, i) => {
                    const val = String(row[key]);
                    acc[i] = Math.max(acc[i] || 0, val.length, key.length);
                });
                return acc;
            }, []);
            worksheet['!cols'] = maxWidths.map((w: number) => ({ w: w + 2 }));

            XLSX.writeFile(workbook, `GR_Customer_Report_${dateRange.start}_to_${dateRange.end}.xlsx`);
            showNotification("Customer GR Report exported successfully");
        } catch (error) {
            console.error("Export failed", error);
            showNotification("Export failed", "error");
        } finally {
            setIsExporting(false);
        }
    };

    const exportStockReport = () => {
        setIsExporting(true);
        try {
            // Calculate current GR Stock (Stock Room)
            const stockMap: Record<string, any> = {};
            
            // 1. Add all returns
            grs.forEach(gr => {
                if (gr.items) {
                    gr.items.forEach((entry: any) => {
                        const key = `${entry.brand}-${entry.model}-${entry.quality}`.toUpperCase();
                        if (!stockMap[key]) {
                            stockMap[key] = {
                                'Brand': entry.brand,
                                'Model': entry.model,
                                'Quality': entry.quality,
                                'Category': entry.category || '',
                                'Current GR Stock': 0,
                                'Last Return Date': gr.orderTime
                            };
                        }
                        stockMap[key]['Current GR Stock'] += (entry.returnQty || 0);
                    });
                }
            });

            // 2. Subtract removals
            const removalsStr = localStorage.getItem('apexflow_gr_physical_removals');
            if (removalsStr) {
                const removalsMap = JSON.parse(removalsStr);
                Object.keys(removalsMap).forEach(key => {
                    if (stockMap[key]) {
                        stockMap[key]['Current GR Stock'] -= removalsMap[key];
                        if (stockMap[key]['Current GR Stock'] < 0) stockMap[key]['Current GR Stock'] = 0;
                    }
                });
            }

            const data = Object.values(stockMap).filter(i => i['Current GR Stock'] > 0);
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "GR Stock Report");
            
            XLSX.writeFile(workbook, `GR_Stock_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
            showNotification("GR Stock Report exported successfully");
        } catch (error) {
            console.error("Export failed", error);
            showNotification("Export failed", "error");
        } finally {
            setIsExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Generating Report Engine...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full -mr-32 -mt-32 blur-3xl" />
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                            <FileText size={32} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">GR REPORTS</h1>
                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">Export GR Data to Excel</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={loadData}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-50 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Sync Data
                    </button>
                </div>
            </div>

            {/* Controls Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Customer Report Card */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between mb-8">
                        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UserCircle2 size={28} />
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Type</p>
                            <p className="text-lg font-black text-slate-900">Customer GR Summary</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input 
                                        type="date" 
                                        value={dateRange.start}
                                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input 
                                        type="date" 
                                        value={dateRange.end}
                                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                            <p className="text-[10px] text-emerald-700 font-bold">
                                This report includes total GR counts, total return values, and unit summaries for each customer within the selected date range.
                            </p>
                        </div>

                        <button 
                            onClick={exportCustomerReport}
                            disabled={isExporting}
                            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-emerald-100 hover:bg-emerald-700 hover:shadow-emerald-200 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                            Export Customer Report
                        </button>
                    </div>
                </div>

                {/* Stock Report Card */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between mb-8">
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Package size={28} />
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Type</p>
                            <p className="text-lg font-black text-slate-900">Current GR Stock</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total GR Units in Stock</p>
                                <div className="px-2 py-1 bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-black">LIVE</div>
                            </div>
                            <p className="text-3xl font-black text-slate-900">
                                {grs.reduce((sum, gr) => sum + (gr.items?.reduce((s: number, i: any) => s + (i.returnQty || 0), 0) || 0), 0)}
                            </p>
                        </div>

                        <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                            <p className="text-[10px] text-indigo-700 font-bold">
                                This report provides a detailed breakdown of all items currently sitting in the GR Stock Room, including Brand, Model, and Quality.
                            </p>
                        </div>

                        <button 
                            onClick={exportStockReport}
                            disabled={isExporting}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                            Export Stock Report
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GRReports;
