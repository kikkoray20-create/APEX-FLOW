import React from 'react';
import { 
    ArrowLeft, Store, Calendar, Hash, Tag, Package, 
    TrendingUp, TrendingDown, Clock, Database, User,
    ChevronDown, ChevronUp
} from 'lucide-react';
import { InventoryLog } from '../types';

interface InventoryLogDetailProps {
    log: InventoryLog;
    onBack: () => void;
}

const InventoryLogDetail: React.FC<InventoryLogDetailProps> = ({ log, onBack }) => {
    const isAdded = log.status === 'Added';
    const items = log.items || [];
    const itemCount = log.itemCount || items.length;

    return (
        <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16 max-w-[1400px] mx-auto">
            {/* --- BACK BUTTON --- */}
            <div className="no-print">
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                >
                    <ArrowLeft size={16} />
                    Back to Inventories
                </button>
            </div>

            {/* --- HEADER CARD --- */}
            <div className="bg-[#f0f7ff] border border-[#e1effe] rounded-xl p-6 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-slate-700 shadow-sm border border-slate-100">
                        <Store size={20} />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight mb-1">
                            {log.shopName || 'MANUAL ADJUSTMENT'}
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 text-xs font-medium">
                            <div className="flex items-center gap-1.5">
                                <Hash size={12} className="text-slate-400" />
                                <span>Inventory ID: {log.id.split('-')[1] || log.id}</span>
                            </div>
                            <span className="text-slate-300">|</span>
                            <div className="flex items-center gap-1.5">
                                <Calendar size={12} className="text-slate-400" />
                                <span>Created: {log.createdDate}</span>
                            </div>
                            <span className="text-slate-300">|</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${isAdded ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                {log.status}
                            </span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-[#e1effe]">
                            <p className="text-xs text-slate-600 font-medium">
                                <span className="text-slate-400 font-bold">Remarks:</span> {log.remarks || 'No remarks provided.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- TABLE CARD --- */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">
                        Inventory Items ({itemCount})
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">ID</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Brand</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Quality</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Model</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Warehouse</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Quantity</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Price/Unit</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {items.length > 0 ? items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                        {idx + 10001}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded border border-blue-100 uppercase">
                                            {it.brand}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded border border-emerald-100 uppercase">
                                            {it.quality}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-bold text-slate-700 uppercase">
                                        {it.category || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-xs font-bold text-slate-700 uppercase">
                                        {it.model}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold rounded border border-orange-100 uppercase">
                                            {it.warehouse || 'APEXFLOW'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="px-2 py-1 bg-purple-50 text-purple-600 text-[10px] font-bold rounded border border-purple-100">
                                            {it.quantity}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-xs font-bold text-emerald-600">
                                            ₹{it.price || '0.0'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded border border-emerald-100 uppercase">
                                            {it.status || 'Active'}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr className="hover:bg-slate-50/30 transition-colors">
                                    <td className="px-6 py-4 text-xs font-medium text-slate-500">1</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded border border-blue-100 uppercase">N/A</span></td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded border border-emerald-100 uppercase">N/A</span></td>
                                    <td className="px-6 py-4 text-xs font-bold text-slate-700 uppercase">N/A</td>
                                    <td className="px-6 py-4 text-xs font-bold text-slate-700 uppercase">{log.modelName}</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold rounded border border-orange-100 uppercase">MAIN HUB</span></td>
                                    <td className="px-6 py-4 text-center"><span className="px-2 py-1 bg-purple-50 text-purple-600 text-[10px] font-bold rounded border border-purple-100">{log.quantityChange}</span></td>
                                    <td className="px-6 py-4 text-center"><span className="text-xs font-bold text-emerald-600">₹0.0</span></td>
                                    <td className="px-6 py-4 text-center"><span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded border border-emerald-100 uppercase">Active</span></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-8 border-t border-slate-50 flex flex-col items-center gap-2">
                    <p className="text-xs font-medium text-slate-400">No more items to load</p>
                    <p className="text-xs font-bold text-slate-500">Showing {items.length || 1} of {itemCount} items</p>
                </div>
            </div>
        </div>
    );
};

export default InventoryLogDetail;
