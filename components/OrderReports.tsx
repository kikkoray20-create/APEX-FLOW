
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

    // Precise parsing of date/time string for accurate sorting
    const parseOrderDate = (dateStr: string) => {
        try {
            const [dPart, tPart, ampm] = dateStr.split(' ');
            const [d, m, y] = dPart.split('/').map(Number);
            let [hh, mm] = (tPart || '00:00').split(':').map(Number);
            if (ampm === 'PM' && hh < 12) hh += 12;
            if (ampm === 'AM' && hh === 12) hh = 0;
            return new Date(y, m - 1, d, hh, mm).getTime();
        } catch (e) { return 0; }
    };

    const verifiedOrdersInRange = useMemo(() => {
        const filtered = orders.filter(o => {
            if (!['checked', 'dispatched'].includes(o.status)) return false;
            try {
                const [datePart] = o.orderTime.split(' ');
                const [d, m, y] = datePart.split('/');
                const orderDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                return orderDate >= dateRange.start && orderDate <= dateRange.end;
            } catch (e) { return false; }
        });
        
        return filtered.sort((a, b) => parseOrderDate(b.orderTime) - parseOrderDate(a.orderTime));
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

    const exportSummary = async (filtered: Order[]) => {
        if (filtered.length === 0) return;
        
        try {
            const ExcelJS = (await import('exceljs')).default;
            const { saveAs } = (await import('file-saver')).default;
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Order Summary');

            worksheet.columns = [
                { header: 'Order ID', key: 'id', width: 20 },
                { header: 'Customer Name', key: 'customer', width: 30 },
                { header: 'Date & Time', key: 'date', width: 25 },
                { header: 'Total Amount', key: 'amount', width: 15 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Warehouse', key: 'warehouse', width: 20 }
            ];

            filtered.forEach(o => {
                worksheet.addRow({
                    id: o.id,
                    customer: o.customerName,
                    date: o.orderTime,
                    amount: o.totalAmount || 0,
                    status: o.status.toUpperCase(),
                    warehouse: o.warehouse
                });
            });

            const headerRow = worksheet.getRow(1);
            headerRow.font = { name: 'Calibri', size: 12, bold: true };
            headerRow.eachCell((cell, colNumber) => {
                if (colNumber === 4) { // Total Amount
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                } else {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                }
            });

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) {
                    row.font = { name: 'Calibri', size: 11 };
                    row.eachCell((cell, colNumber) => {
                        if (colNumber === 4) { // Total Amount
                            cell.alignment = { horizontal: 'right', vertical: 'middle' };
                            cell.numFmt = '0.0';
                        } else {
                            cell.alignment = { horizontal: 'left', vertical: 'middle' };
                        }
                    });
                }
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Order_Summary_${dateRange.start}_to_${dateRange.end}.xlsx`);
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            showNotification('Failed to export to Excel.', 'error');
        }
    };

    const exportDetail = async (filtered: Order[]) => {
        if (filtered.length === 0) return;
        
        try {
            const ExcelJS = (await import('exceljs')).default;
            const { saveAs } = (await import('file-saver')).default;
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Detailed Report');

            worksheet.columns = [
                { header: 'Order ID', key: 'id', width: 20 },
                { header: 'Customer', key: 'customer', width: 30 },
                { header: 'Date & Time', key: 'date', width: 25 },
                { header: 'Brand', key: 'brand', width: 15 },
                { header: 'Model', key: 'model', width: 35 },
                { header: 'Qty', key: 'qty', width: 10 },
                { header: 'Rate', key: 'rate', width: 15 },
                { header: 'Subtotal', key: 'subtotal', width: 15 }
            ];

            filtered.forEach(o => {
                const storedItems = localStorage.getItem(`apexflow_items_${o.id}`);
                const items: OrderItem[] = storedItems ? JSON.parse(storedItems) : [];
                if (items.length > 0) {
                    items.forEach((item, index) => {
                        const rowQty = item.fulfillQty || 0;
                        const rowRate = item.finalPrice || 0;
                        const rowSubtotal = rowQty * rowRate;
                        worksheet.addRow({
                            id: index === 0 ? o.id : '',
                            customer: index === 0 ? o.customerName : '',
                            date: index === 0 ? o.orderTime : '',
                            brand: item.brand,
                            model: item.model,
                            qty: rowQty,
                            rate: rowRate,
                            subtotal: rowSubtotal
                        });
                    });
                    worksheet.addRow({}); // Empty row
                }
            });

            const headerRow = worksheet.getRow(1);
            headerRow.font = { name: 'Calibri', size: 12, bold: true };
            headerRow.eachCell((cell, colNumber) => {
                if (colNumber >= 6) { // Qty, Rate, Subtotal
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                } else {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                }
            });

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) {
                    row.font = { name: 'Calibri', size: 11 };
                    row.eachCell((cell, colNumber) => {
                        if (colNumber === 6) { // Qty
                            cell.alignment = { horizontal: 'right', vertical: 'middle' };
                            cell.numFmt = '0';
                        } else if (colNumber === 7 || colNumber === 8) { // Rate, Subtotal
                            cell.alignment = { horizontal: 'right', vertical: 'middle' };
                            cell.numFmt = '0.0';
                        } else {
                            cell.alignment = { horizontal: 'left', vertical: 'middle' };
                        }
                    });
                }
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Order_Detailed_${dateRange.start}_to_${dateRange.end}.xlsx`);
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            showNotification('Failed to export to Excel.', 'error');
        }
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
