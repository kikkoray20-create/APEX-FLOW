
import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, FileText, Download, RefreshCw, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react';
import { Order, OrderItem } from '../types';
import { fetchOrders } from '../services/db';
import { useNotification } from '../context/NotificationContext';

const OrderReports: React.FC = () => {
    const { showNotification } = useNotification();
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState<Order[]>([]);
    const [reportType, setReportType] = useState<'summary' | 'detail'>('summary');
    
    // Set default date range to last 7 days
    const [dateRange, setDateRange] = useState(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 7);
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    });

    useEffect(() => { loadBaseData(); }, []);
    const loadBaseData = async () => {
        setLoading(true);
        const o = await fetchOrders();
        setOrders(o);
        setLoading(false);
    };

    const verifiedOrdersInRange = useMemo(() => {
        return orders.filter(o => {
            if (!['checked', 'dispatched'].includes(o.status)) return false;
            try {
                const [datePart] = o.orderTime.split(' ');
                const [d, m, y] = datePart.split('/');
                const orderDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                return orderDate >= dateRange.start && orderDate <= dateRange.end;
            } catch (e) { return false; }
        });
    }, [orders, dateRange]);

    const handleExport = async () => {
        if (verifiedOrdersInRange.length === 0) {
            showNotification('No checked or dispatched orders found in selected range', 'error');
            return;
        }
        if (reportType === 'summary') exportSummary(verifiedOrdersInRange);
        else exportDetail(verifiedOrdersInRange);
        showNotification(`Report Exported Successfully`);
    };

    const exportSummary = (filtered: Order[]) => {
        const data = filtered.map(o => ({
            'Order ID': o.id,
            'Date': o.orderTime.split(' ')[0],
            'Customer Name': o.customerName,
            'Total Amount': (o.totalAmount || 0).toFixed(1),
            'Status': o.status.toUpperCase(),
            'Warehouse': o.warehouse
        }));
        
        const ws = (window as any).XLSX.utils.json_to_sheet(data);
        const wb = (window as any).XLSX.utils.book_new();
        (window as any).XLSX.utils.book_append_sheet(wb, ws, "Order Summary");
        (window as any).XLSX.writeFile(wb, `Order_Summary_${dateRange.start}_to_${dateRange.end}.xlsx`);
    };

    const exportDetail = (filtered: Order[]) => {
        const detailedRows: any[] = [];
        filtered.forEach(o => {
            const storedItems = localStorage.getItem(`apexflow_items_${o.id}`);
            const items: OrderItem[] = storedItems ? JSON.parse(storedItems) : [];
            if (items.length > 0) {
                items.forEach((item, index) => {
                    const rowQty = item.fulfillQty || 0;
                    const rowRate = item.finalPrice || 0;
                    const rowSubtotal = rowQty * rowRate;
                    detailedRows.push({
                        'Order ID': index === 0 ? o.id : '',
                        'Date': index === 0 ? o.orderTime.split(' ')[0] : '',
                        'Customer': index === 0 ? o.customerName : '',
                        'Brand': item.brand,
                        'Model': item.model,
                        'Qty': rowQty,
                        'Rate': rowRate.toFixed(1),
                        'Subtotal': rowSubtotal.toFixed(1)
                    });
                });
                detailedRows.push({}); 
            }
        });
        
        const ws = (window as any).XLSX.utils.json_to_sheet(detailedRows);
        const wb = (window as any).XLSX.utils.book_new();
        (window as any).XLSX.utils.book_append_sheet(wb, ws, "Detailed Report");
        (window as any).XLSX.writeFile(wb, `Order_Detailed_${dateRange.start}_to_${dateRange.end}.xlsx`);
    };

    return (
        <div className="flex flex-col space-y-6 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                        <FileSpreadsheet size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Export Reports</h1>
                        <p className="text-sm text-slate-500">Download Excel logs of checked/dispatched orders.</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date Range</label>
                        <div className="flex gap-2">
                            <input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-indigo-500 transition-all" />
                            <input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-indigo-500 transition-all" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Format</label>
                        <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200">
                            <button onClick={() => setReportType('summary')} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${reportType === 'summary' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Summary</button>
                            <button onClick={() => setReportType('detail')} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${reportType === 'detail' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Detail</button>
                        </div>
                    </div>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg flex items-start gap-3">
                    <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">Export applies only to Checked or Dispatched orders.</p>
                </div>
                <button onClick={handleExport} disabled={loading || verifiedOrdersInRange.length === 0} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <><Download size={18} /> Generate Excel</>}
                </button>
            </div>
        </div>
    );
};

export default OrderReports;
