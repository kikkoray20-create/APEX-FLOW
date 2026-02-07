import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, 
    Printer, 
    Download, 
    Share2, 
    Layers, 
    ReceiptText, 
    User, 
    Calendar,
    CreditCard,
    RotateCcw,
    MessageSquare
} from 'lucide-react';
import { Order } from '../types';
import { useNotification } from '../context/NotificationContext';

interface FinancialInvoiceProps {
    order: Order;
    onClose: () => void;
}

const FinancialInvoice: React.FC<FinancialInvoiceProps> = ({ order, onClose }) => {
    const { showNotification } = useNotification();
    const [items, setItems] = useState<any[]>([]);

    useEffect(() => {
        // For Returns, load detailed items breakdown
        if (order.status === 'Return') {
            const stored = localStorage.getItem(`apexflow_gr_items_${order.id}`);
            if (stored) setItems(JSON.parse(stored));
        }
    }, [order.id, order.status]);

    const handlePrint = () => {
        window.print();
    };

    const handleDownload = () => {
        const originalTitle = document.title;
        document.title = `${order.status}_${order.id}`;
        window.print();
        document.title = originalTitle;
    };

    const handleShare = async () => {
        const type = order.status === 'Payment' ? 'RECEIPT' : 'CREDIT NOTE';
        const text = `*APEXFLOW ${type}*\nRef: #${order.id.slice(-8)}\nClient: ${order.customerName}\nAmount: ₹${Math.abs(order.totalAmount || 0).toFixed(1)}\nDate: ${order.orderTime}${order.remarks ? `\nRemark: ${order.remarks}` : ''}`;
        
        if (navigator.share) {
            try { await navigator.share({ title: `${type} Summary`, text }); } catch (e) {}
        } else {
            navigator.clipboard.writeText(text);
            showNotification('Summary copied to clipboard');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[200] flex items-center justify-center p-2 md:p-6 overflow-y-auto print:static print:bg-white print:p-0 animate-in fade-in duration-300">
            
            {/* Top Right Exit Button */}
            <button 
                onClick={onClose}
                className="fixed top-6 right-6 md:top-10 md:right-10 z-[210] flex items-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-full font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-rose-900/40 hover:bg-rose-700 transition-all hover:scale-105 active:scale-95 no-print"
            >
                <X size={18} strokeWidth={3} />
                <span>Exit Portal</span>
            </button>

            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-slate-100 print:shadow-none print:border-none print:rounded-none animate-in zoom-in-95">
                
                {/* Header (No Print) */}
                <div className="px-8 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 no-print">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${order.status === 'Payment' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            {order.status === 'Payment' ? <CreditCard size={18} /> : <RotateCcw size={18} />}
                        </div>
                        <span className="text-sm font-black text-slate-700 uppercase tracking-widest">
                            {order.status === 'Payment' ? 'Payment Receipt' : 'Goods Return Credit'}
                        </span>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-rose-500 transition-colors p-2 rounded-full hover:bg-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-4 md:p-12 print:p-0 bg-slate-100/50 print:bg-white overflow-y-auto custom-scrollbar">
                    <div className="bg-white w-full max-w-[600px] mx-auto min-h-[700px] shadow-sm p-8 md:p-14 border border-slate-200 print:shadow-none print:border-none print:p-10 font-sans text-slate-900 flex flex-col">
                        
                        {/* Brand Section */}
                        <div className="text-center mb-12">
                            <div className="flex items-center justify-center gap-3 mb-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${order.status === 'Payment' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                                    <Layers size={24} strokeWidth={2.5} />
                                </div>
                                <h1 className="text-3xl font-black tracking-tighter uppercase text-slate-900">ApexFlow Management</h1>
                            </div>
                            <div className={`h-1 w-20 mx-auto mb-4 ${order.status === 'Payment' ? 'bg-emerald-600' : 'bg-rose-600'}`}></div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">
                                {order.status === 'Payment' ? 'Electronic Payment Voucher' : 'Restoration Credit Note'}
                            </p>
                        </div>

                        {/* Customer & Info */}
                        <div className="flex justify-between items-start mb-12 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Account Holder</p>
                                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">{order.customerName}</h3>
                                    <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">{order.customerSubtext}</p>
                                </div>
                            </div>
                            <div className="text-right space-y-2">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Document Meta</p>
                                <p className="text-[11px] font-bold text-slate-600 uppercase">Ref ID: <span className="text-slate-900 font-black">#{order.id.toString().slice(-10)}</span></p>
                                <p className="text-[11px] font-bold text-slate-600 uppercase">Date: <span className="text-slate-900 font-black">{order.orderTime}</span></p>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="flex-1">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-y-2 border-slate-900">
                                        <th className="py-4 px-1 text-left text-[10px] font-black uppercase tracking-widest text-slate-900">Description</th>
                                        {order.status === 'Return' && (
                                            <>
                                                <th className="py-4 px-1 text-center text-[10px] font-black uppercase tracking-widest text-slate-900 w-12">Qty</th>
                                                <th className="py-4 px-1 text-center text-[10px] font-black uppercase tracking-widest text-slate-900 w-20">Rate</th>
                                            </>
                                        )}
                                        <th className="py-4 px-1 text-right text-[10px] font-black uppercase tracking-widest text-slate-900 w-24">Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {order.status === 'Return' && items.length > 0 ? (
                                        items.map((entry, idx) => (
                                            <tr key={idx}>
                                                <td className="py-4 px-1">
                                                    <p className="text-[11px] font-black text-slate-800 uppercase leading-tight">
                                                        {entry.item.brand} {entry.item.quality} {entry.item.model}
                                                    </p>
                                                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Restored to Inventory</p>
                                                </td>
                                                <td className="py-4 px-1 text-center font-black text-slate-900 text-sm">{entry.returnQty}</td>
                                                <td className="py-4 px-1 text-center font-bold text-slate-500 text-xs">₹{entry.returnPrice.toFixed(1)}</td>
                                                <td className="py-4 px-1 text-right font-black text-emerald-600 text-sm">₹{(entry.returnQty * entry.returnPrice).toFixed(1)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td className="py-10 px-1">
                                                <p className="text-[13px] font-black text-slate-800 uppercase leading-tight">
                                                    {order.status === 'Payment' ? 'Account Credit Receipt' : 'Goods Return Credit Adjustment'}
                                                </p>
                                                <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase italic">Processed at {order.warehouse}</p>
                                            </td>
                                            {order.status === 'Return' && (
                                                <>
                                                    <td className="py-10 px-1 text-center font-black text-slate-400">-</td>
                                                    <td className="py-10 px-1 text-center font-black text-slate-400">-</td>
                                                </>
                                            )}
                                            <td className="py-10 px-1 text-right font-black text-slate-900 text-lg">₹{Math.abs(order.totalAmount || 0).toFixed(1)}</td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-900 bg-slate-50/50">
                                        <td colSpan={order.status === 'Return' ? 3 : 1} className="py-6 px-1 text-sm font-black uppercase tracking-widest text-slate-900">
                                            Total Credit Applied
                                        </td>
                                        <td className={`py-6 px-1 text-right text-2xl font-black tracking-tighter ${order.status === 'Payment' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            ₹{Math.abs(order.totalAmount || 0).toFixed(1)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* --- REMARKS SECTION --- */}
                        {order.remarks && (
                            <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <div className="flex items-center gap-2 mb-2 text-slate-400">
                                    <MessageSquare size={14} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Transaction Remark</span>
                                </div>
                                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-tight leading-relaxed">
                                    {order.remarks}
                                </p>
                            </div>
                        )}

                        {/* Footer Sign-off */}
                        <div className="mt-16 pt-10 border-t border-slate-100 grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    <ReceiptText size={12} className={order.status === 'Payment' ? 'text-emerald-500' : 'text-rose-500'} /> System Note
                                </h5>
                                <p className="text-[9px] text-slate-400 font-medium leading-relaxed uppercase tracking-tight">
                                    This is a computer-generated transaction record for the client account ledger. Verified via ApexFlow distribution network.
                                </p>
                            </div>
                            <div className="flex flex-col items-end justify-center">
                                <div className="w-40 h-12 border-b border-slate-200 mb-2 relative">
                                    <p className="absolute bottom-1 right-0 text-[8px] text-slate-300 font-black uppercase italic tracking-widest">APEXFLOW AUTHORIZED</p>
                                </div>
                                <p className="text-[9px] font-black text-slate-800 uppercase tracking-[0.2em]">ACCOUNTS OFFICER</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-8 py-5 bg-white border-t border-slate-200 flex flex-wrap justify-center md:justify-end gap-3 no-print">
                    <button onClick={onClose} className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all">Close</button>
                    <button onClick={handleDownload} className="flex items-center justify-center gap-2 px-8 py-3 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">
                        <Download size={16} /> Download
                    </button>
                    <button onClick={handleShare} className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95">
                        <Share2 size={16} /> Share
                    </button>
                    <button onClick={handlePrint} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-10 py-3 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 ${order.status === 'Payment' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'}`}>
                        <Printer size={16} /> Print Copy
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FinancialInvoice;