import React from 'react';
import { Eye, ArrowRight, CreditCard, Globe, ShoppingBag, UserCheck, ArrowUp, ArrowDown } from 'lucide-react';
import { Order, UserRole } from '../types';

interface OrderTableProps {
  orders: Order[];
  onViewOrder: (order: Order) => void;
  userRole?: UserRole;
  onSort?: (key: keyof Order) => void;
  sortConfig?: { key: keyof Order | null, direction: 'asc' | 'desc' | null };
}

const OrderTable: React.FC<OrderTableProps> = ({ orders, onViewOrder, userRole, onSort, sortConfig }) => {
  const isStaff = userRole && ['Picker', 'Checker', 'Dispatcher'].includes(userRole);

  const SortIndicator = ({ columnKey }: { columnKey: keyof Order }) => {
    if (!sortConfig || sortConfig.key !== columnKey) return (
      <div className="flex flex-col opacity-10 ml-2">
        <ArrowUp size={8} strokeWidth={4} />
        <ArrowDown size={8} strokeWidth={4} />
      </div>
    );
    return (
      <div className="flex flex-col ml-2 text-indigo-600">
        {sortConfig.direction === 'asc' ? <ArrowUp size={10} strokeWidth={4} /> : <ArrowDown size={10} strokeWidth={4} />}
      </div>
    );
  };

  const HeaderCell = ({ label, columnKey, className = "" }: { label: string, columnKey?: keyof Order, className?: string }) => {
    const isSortable = !!columnKey && !!onSort;
    return (
      <th 
        className={`${className} px-6 py-5 ${isSortable ? 'cursor-pointer hover:bg-slate-100/50 transition-colors' : ''}`}
        onClick={() => isSortable && onSort?.(columnKey!)}
      >
        <div className={`flex items-center ${className.includes('text-center') ? 'justify-center' : ''}`}>
          <span>{label}</span>
          {isSortable && <SortIndicator columnKey={columnKey!} />}
        </div>
      </th>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-4xl overflow-hidden shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)]">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left">
          <thead>
            <tr className="table-header select-none">
              <HeaderCell label="Order ID" />
              <HeaderCell label="Customer Info" columnKey="customerName" />
              <HeaderCell label="Order Time" columnKey="orderTime" />
              <HeaderCell label="Warehouse" columnKey="warehouse" />
              {!isStaff && <HeaderCell label="Status" columnKey="status" className="text-center" />}
              {!isStaff && <HeaderCell label="Invoice Status" columnKey="invoiceStatus" className="text-center" />}
              <HeaderCell label="Order Mode" columnKey="orderMode" className="text-center" />
              <th className="px-6 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.length === 0 ? (
               <tr><td colSpan={isStaff ? 6 : 8} className="px-8 py-32 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No entries found in pipeline</td></tr>
            ) : orders.map((order: Order) => (
              <tr key={order.id} className="hover:bg-slate-50/80 transition-all group">
                {/* Order ID */}
                <td className="px-6 py-6">
                    <span className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors">#{order.id}</span>
                </td>

                {/* Customer Info */}
                <td className="px-6 py-6">
                  <div className="flex flex-col">
                    <span className="text-[12px] font-black text-slate-800 uppercase tracking-tight leading-tight">{order.customerName}</span>
                    {order.status === 'Payment' && <span className="text-[8px] font-black text-emerald-500 uppercase mt-1 tracking-widest">Financial Credit Entry</span>}
                    {order.status === 'Return' && <span className="text-[8px] font-black text-rose-500 uppercase mt-1 tracking-widest">Goods Return Entry</span>}
                  </div>
                </td>

                {/* Order Time */}
                <td className="px-6 py-6">
                    <span className="text-[11px] text-slate-500 font-bold uppercase whitespace-nowrap">{order.orderTime}</span>
                </td>

                {/* Warehouse */}
                <td className="px-6 py-6">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{order.warehouse}</span>
                </td>

                {/* Status (Hidden for Staff) */}
                {!isStaff && (
                    <td className="px-6 py-6">
                        <div className="flex justify-center">
                            <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border text-center min-w-[120px] ${
                                order.status === 'fresh' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                                order.status === 'checked' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                order.status === 'dispatched' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                order.status === 'packed' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                order.status === 'assigned' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                order.status === 'rejected' ? 'bg-rose-600 text-white border-rose-700 shadow-sm' :
                                order.status === 'Payment' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' :
                                order.status === 'Return' ? 'bg-rose-500 text-white border-rose-600 shadow-sm' :
                                'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                                {order.status === 'assigned' ? (order.assignedTo || 'ASSIGNED') : order.status}
                            </span>
                        </div>
                    </td>
                )}

                {/* Invoice Status (Hidden for Staff) */}
                {!isStaff && (
                    <td className="px-6 py-6">
                    <div className="flex justify-center">
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border ${
                        order.invoiceStatus === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        order.invoiceStatus === 'Sent' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                        <CreditCard size={10} />
                        {order.invoiceStatus}
                        </span>
                    </div>
                    </td>
                )}

                {/* Order Mode */}
                <td className="px-6 py-6">
                  <div className="flex justify-center">
                    <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      {order.orderMode === 'Online' ? <Globe size={12} className="text-indigo-500" /> : <ShoppingBag size={12} className="text-slate-400" />}
                      {order.orderMode}
                    </span>
                  </div>
                </td>

                {/* Actions */}
                <td className="px-6 py-6">
                  <div className="flex justify-end">
                    <button 
                        onClick={() => onViewOrder(order)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#4f46e5] text-white rounded-xl shadow-lg shadow-indigo-100 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all"
                    >
                        View
                        <ArrowRight size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderTable;