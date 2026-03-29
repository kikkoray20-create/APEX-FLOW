
import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, FileText, Download, RefreshCw, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react';
import { Order, OrderItem } from '../types';
import { fetchOrders } from '../services/db';
import { useNotification } from '../context/NotificationContext';

const DateInput = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
    const formattedDate = value ? value.split('-').reverse().join('/') : 'DD/MM/YYYY';
    return (
        <div className="relative w-full">
            <input 
                type="date" 
                value={value} 
                onChange={(e) => onChange(e.target.value)} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 flex items-center justify-between">
                <span>{formattedDate}</span>
                <Calendar size={16} className="text-slate-400 pointer-events-none" />
            </div>
        </div>
    );
};

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
            if (!dateStr) return 0;
            const [dPart, tPart, ampm] = dateStr.split(' ');
            let d, m, y;
            if (dPart.includes('/')) {
                [d, m, y] = dPart.split('/').map(Number);
            } else if (dPart.includes('-')) {
                const parts = dPart.split('-');
                if (parts[0].length === 4) {
                    [y, m, d] = parts.map(Number);
                } else {
                    [d, m, y] = parts.map(Number);
                }
            } else {
                const time = new Date(dateStr).getTime();
                return isNaN(time) ? 0 : time;
            }
            
            let [hh, mm] = (tPart || '00:00').split(':').map(Number);
            if (ampm === 'PM' && hh < 12) hh += 12;
            if (ampm === 'AM' && hh === 12) hh = 0;
            const time = new Date(y, m - 1, d, hh, mm).getTime();
            return isNaN(time) ? 0 : time;
        } catch (e) { return 0; }
    };

    const verifiedOrdersInRange = useMemo(() => {
        const filtered = orders.filter(o => {
            if (!['checked', 'dispatched'].includes(o.status)) return false;
            try {
                if (!o.orderTime) return false;
                const [datePart] = o.orderTime.split(' ');
                let orderDate = '';
                if (datePart.includes('/')) {
                    const [d, m, y] = datePart.split('/');
                    orderDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                } else if (datePart.includes('-')) {
                    const parts = datePart.split('-');
                    if (parts[0].length === 4) {
                        orderDate = datePart; // already YYYY-MM-DD
                    } else {
                        const [d, m, y] = parts;
                        orderDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                    }
                } else {
                    return false;
                }
                return orderDate >= dateRange.start && orderDate <= dateRange.end;
            } catch (e) { return false; }
        });
        
        return filtered.sort((a, b) => {
            const timeA = parseOrderDate(a.orderTime);
            const timeB = parseOrderDate(b.orderTime);
            if (timeA !== timeB) return timeB - timeA;
            return (Number(b.id) || 0) - (Number(a.id) || 0);
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
                { header: 'Warehouse', key: 'warehouse', width: 20 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Order Mode', key: 'orderMode', width: 15 },
                { header: 'Total Amount', key: 'amount', width: 15 }
            ];

            filtered.forEach(o => {
                worksheet.addRow({
                    id: o.id,
                    customer: o.customerName,
                    date: o.orderTime,
                    warehouse: o.warehouse,
                    status: o.status.toUpperCase(),
                    orderMode: o.orderMode || 'Offline',
                    amount: o.totalAmount || 0
                });
            });

            const headerRow = worksheet.getRow(1);
            headerRow.font = { name: 'Calibri', size: 12, bold: true };
            headerRow.eachCell((cell, colNumber) => {
                if (colNumber === 7) { // Total Amount
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                } else {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                }
            });

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) {
                    row.font = { name: 'Calibri', size: 11 };
                    row.eachCell((cell, colNumber) => {
                        if (colNumber === 7) { // Total Amount
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
                let items: OrderItem[] = o.items || [];
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
                } else {
                    worksheet.addRow({
                        id: o.id,
                        customer: o.customerName,
                        date: o.orderTime,
                        brand: '',
                        model: '',
                        qty: 0,
                        rate: 0,
                        subtotal: 0
                    });
                }
                worksheet.addRow({}); // Empty row
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
                            <DateInput value={dateRange.start} onChange={(val) => setDateRange({...dateRange, start: val})} />
                            <DateInput value={dateRange.end} onChange={(val) => setDateRange({...dateRange, end: val})} />
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
