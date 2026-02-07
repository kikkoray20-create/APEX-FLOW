
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, RefreshCw, Loader2, ArrowUpRight, 
  TrendingUp, BarChart3, PackageCheck 
} from 'lucide-react';
import { Order } from '../types';
import { fetchOrders } from '../services/db';
import { useNotification } from '../context/NotificationContext';

const DailyFulfilledSummary: React.FC = () => {
  const { showNotification } = useNotification();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Set default date range to last 1 month
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(end.getMonth() - 1);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchOrders();
      setOrders(data);
    } catch (e) {
      showNotification('Failed to sync orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    showNotification('Report refreshed successfully');
  };

  const dailyStats = useMemo(() => {
    const stats: Record<string, { totalQty: number, dateObj: Date }> = {};
    
    orders.forEach(o => {
      // Logic: but only 'checked' or 'dispatched' status
      if (o.status !== 'checked' && o.status !== 'dispatched') return;

      try {
        const [datePart] = o.orderTime.split(' ');
        const [d, m, y] = datePart.split('/');
        const orderDateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        
        // Date Range Filtering
        if (orderDateStr < dateRange.start || orderDateStr > dateRange.end) return;

        if (!stats[orderDateStr]) {
          stats[orderDateStr] = { totalQty: 0, dateObj: new Date(Number(y), Number(m) - 1, Number(d)) };
        }

        const orderItems = o.items || [];
        const fulfilledInOrder = orderItems.reduce((sum, item) => sum + (item.fulfillQty || 0), 0);
        stats[orderDateStr].totalQty += fulfilledInOrder;
      } catch (e) { /* Invalid date format */ }
    });

    return Object.entries(stats)
      .map(([dateStr, data]) => ({
        date: dateStr,
        displayDate: data.dateObj.toLocaleDateString('en-GB'),
        dayName: data.dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
        qty: data.totalQty
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [orders, dateRange]);

  const summary = useMemo(() => {
    const totalQty = dailyStats.reduce((sum, s) => sum + s.qty, 0);
    const totalDays = dailyStats.length;
    const avg = totalDays > 0 ? Math.round(totalQty / totalDays) : 0;
    return { totalQty, totalDays, avg };
  }, [dailyStats]);

  return (
    <div className="flex flex-col space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 no-print">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">Order Summary - Daily Fulfilled Quantity</h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-3">View daily summary of fulfilled quantities for orders with status checked or dispatched.</p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date Range</div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input 
              type="date" 
              value={dateRange.start} 
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})} 
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
            />
            <div className="w-4 h-px bg-slate-200"></div>
            <input 
              type="date" 
              value={dateRange.end} 
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})} 
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={loadData}
            className="flex-1 md:flex-none px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <BarChart3 size={16} /> Generate Report
          </button>
          <button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="p-3.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 shadow-sm transition-all active:rotate-180 duration-700"
          >
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-blue-500 shadow-xl shadow-blue-50 flex flex-col items-center justify-center text-center">
          <h4 className="text-5xl font-black text-blue-600 tracking-tighter mb-2">{summary.totalDays}</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Total Days</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-emerald-500 shadow-xl shadow-emerald-50 flex flex-col items-center justify-center text-center">
          <h4 className="text-5xl font-black text-emerald-600 tracking-tighter mb-2">{summary.totalQty}</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Total Fulfilled Quantity</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-orange-500 shadow-xl shadow-orange-50 flex flex-col items-center justify-center text-center">
          <h4 className="text-5xl font-black text-orange-600 tracking-tighter mb-2">{summary.avg}</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Average Daily Quantity</p>
        </div>
      </div>

      {/* Detailed List */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col">
        <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Daily Fulfilled Quantity Summary</h3>
          <span className="text-[9px] font-bold text-slate-400 uppercase">Showing 1 - {dailyStats.length} Days</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase text-slate-400 font-black">
                <th className="px-10 py-6">Date</th>
                <th className="px-10 py-6 text-right">Total Fulfilled Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={2} className="py-32 text-center"><Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} /></td></tr>
              ) : dailyStats.length === 0 ? (
                <tr><td colSpan={2} className="py-32 text-center text-slate-300 font-black text-[11px] uppercase tracking-[0.3em]">No fulfillment data recorded for this range</td></tr>
              ) : (
                dailyStats.map((stat) => (
                  <tr key={stat.date} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-10 py-6">
                      <div className="flex flex-col">
                        <span className="text-[14px] font-black text-slate-800 tracking-tight">{stat.displayDate}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{stat.dayName}</span>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <span className="inline-flex items-center justify-center min-w-[50px] px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 font-black text-sm tracking-tighter">
                        {stat.qty}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DailyFulfilledSummary;
