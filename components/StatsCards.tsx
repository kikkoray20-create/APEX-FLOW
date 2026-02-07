import React, { useMemo } from 'react';
import { 
  ShoppingBag, Package, UserPlus, Box, 
  CheckCircle, Truck, Send, Clock, ArrowUpRight
} from 'lucide-react';
import { Order } from '../types';

interface StatsCardsProps {
  orders: Order[];
  activeFilter: string;
  onStatusClick: (status: string) => void;
}

const StatsCards: React.FC<StatsCardsProps> = ({ orders, activeFilter, onStatusClick }) => {
  // Use the orders prop directly as it is now pre-filtered by date/mode/warehouse in App.tsx
  const getCount = (status: string) => orders.filter(o => o.status.toLowerCase() === status.toLowerCase()).length;
  
  // Dashboard Total: All physical orders (excluding rejected/payments/returns for the headline total)
  const getDashboardTotal = () => orders.filter(o => o.status !== 'rejected' && o.status !== 'Payment' && o.status !== 'Return').length;
  
  // Pending: Physical orders with 'Pending' invoice status (excluding rejected)
  const getPendingInvoiceCount = () => orders.filter(o => o.invoiceStatus === 'Pending' && o.status !== 'rejected' && o.status !== 'Payment' && o.status !== 'Return').length;

  const stats = [
    { label: 'Dashboard Total', filter: 'ALL STATUS', value: getDashboardTotal(), color: 'text-indigo-600', bg: 'bg-indigo-50', icon: <ShoppingBag size={20}/>, trend: 'ALL' },
    { label: 'Fresh Orders', filter: 'FRESH', value: getCount('fresh'), color: 'text-rose-600', bg: 'bg-rose-50', icon: <Package size={20}/>, trend: 'NEW' },
    { label: 'Assigned', filter: 'ASSIGNED', value: getCount('assigned'), color: 'text-blue-600', bg: 'bg-blue-50', icon: <UserPlus size={20}/>, trend: 'PROC' },
    { label: 'In Packing', filter: 'PACKED', value: getCount('packed'), color: 'text-amber-600', bg: 'bg-amber-50', icon: <Box size={20}/>, trend: 'PACK' },
    { label: 'Quality Check', filter: 'CHECKED', value: getCount('checked'), color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <CheckCircle size={20}/>, trend: 'DONE' },
    { label: 'Dispatch Ready', filter: 'DISPATCHED', value: getCount('dispatched'), color: 'text-orange-600', bg: 'bg-orange-50', icon: <Truck size={20}/>, trend: 'LIVE' },
    { label: 'PENDING', filter: 'PENDING', value: getPendingInvoiceCount(), color: 'text-violet-600', bg: 'bg-violet-50', icon: <Clock size={20}/>, trend: 'INV' },
  ];

  return (
    <div className="mb-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {stats.map((stat, idx) => {
          const isActive = activeFilter === stat.filter;
          return (
            <div 
              key={idx} 
              onClick={() => onStatusClick(stat.filter)}
              className={`p-5 rounded-3xl border transition-all duration-300 group cursor-pointer ${
                isActive 
                  ? 'bg-white border-indigo-500 shadow-xl shadow-indigo-100/50 scale-[1.02] ring-2 ring-indigo-500/10' 
                  : 'bg-white border-slate-200 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] hover:shadow-xl hover:-translate-y-1'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-xl transition-colors ${isActive ? stat.bg + ' ' + stat.color : 'bg-slate-50 text-slate-400 group-hover:' + stat.bg + ' group-hover:' + stat.color}`}>
                  {stat.icon}
                </div>
                <div className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                  {stat.trend}
                </div>
              </div>
              
              <h4 className={`text-[10px] font-extrabold uppercase tracking-widest mb-1 truncate ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                {stat.label}
              </h4>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-black tracking-tighter ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                  {stat.value}
                </span>
                <ArrowUpRight size={14} className={`transition-opacity ${isActive ? 'text-indigo-400 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatsCards;