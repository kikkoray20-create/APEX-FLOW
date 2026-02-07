
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Customer, Firm, Order, OrderStatus, OrderItem, User as UserType } from '../types';
import { 
  Phone, 
  MapPin, 
  Search, 
  Plus, 
  X, 
  Pencil, 
  Loader2, 
  UserCircle, 
  Eye, 
  Building, 
  Hash, 
  MapPinned, 
  UserCheck, 
  Briefcase, 
  ShoppingCart, 
  Info, 
  Users, 
  ReceiptText, 
  Download, 
  Share2, 
  FileText, 
  CheckCircle2, 
  ChevronLeft, 
  User, 
  CreditCard, 
  Lock, 
  Smartphone, 
  Shield, 
  Filter, 
  ChevronDown, 
  RefreshCw,
  AlertTriangle,
  Send,
  PlusCircle,
  MinusCircle,
  Printer,
  ChevronRight,
  MessageSquare,
  Layers,
  RotateCcw,
  Store,
  UserPlus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeft,
  CalendarDays,
  ShieldCheck,
  Check,
  FileDown,
  Maximize2,
  FileText as FileIcon
} from 'lucide-react';
import { fetchCustomers, addCustomerToDB, updateCustomerInDB, fetchFirms, addOrderToDB, fetchOrders, fetchUsers } from '../services/db';
import { useNotification } from '../context/NotificationContext';

interface CustomersProps {
  onCreateOrder?: (customer: Customer) => void;
  currentUser: UserType;
}

const COUNTRY_CODES = [
  { code: '+91', label: '+91' },
  { code: '+977', label: '+977' },
];

const PAGE_SIZE_OPTIONS = [10, 30, 50, 100];
const LEDGER_LIMIT_OPTIONS = [50, 100, 500, 'All'];

const Customers: React.FC<CustomersProps> = ({ onCreateOrder, currentUser }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [staffUsers, setStaffUsers] = useState<UserType[]>([]);
  const { showNotification } = useNotification();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', mode: 'Cash', remarks: '', type: 'Add' as 'Add' | 'Remove' });
  
  // High fidelity Invoice/Statement state
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [viewingTransaction, setViewingTransaction] = useState<Order | null>(null);
  const [previewOrderItems, setPreviewOrderItems] = useState<OrderItem[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [ledgerLimit, setLedgerLimit] = useState<number | 'All'>(50);

  const [formData, setFormData] = useState<any>({
    name: '', countryCode: '+91', phone: '', firmId: '', nickname: '', type: 'Owner',
    status: 'Approved', market: '', password: '', pincode: '', city: '', state: '', address: ''
  });

  const statementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
        const [dbCustomers, dbOrders, dbFirms, dbUsers] = await Promise.all([
          fetchCustomers(currentUser.instanceId),
          fetchOrders(currentUser.instanceId),
          fetchFirms(currentUser.instanceId),
          fetchUsers(currentUser.instanceId)
        ]);
        const sortedCustomers = [...dbCustomers].sort((a, b) => b.id.localeCompare(a.id));
        setCustomers(sortedCustomers);
        setAllOrders(dbOrders);
        setFirms(dbFirms);
        setStaffUsers(dbUsers);
    } catch (e) {
        showNotification('Failed to load cloud records', 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    showNotification('Client records synchronized');
  };

  const superAdminName = useMemo(() => {
      const admin = staffUsers.find(u => u.role === 'Super Admin');
      return admin ? admin.name : 'APEXFLOW MANAGEMENT';
  }, [staffUsers]);

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

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.city) {
      showNotification('Fill all required fields', 'error');
      return;
    }

    const fullPhone = `${formData.countryCode} ${formData.phone.trim()}`;
    const normalizedNewPhone = fullPhone.replace(/\D/g, '');
    const isDuplicatePhone = customers.some(c => 
      c.id !== formData.id && c.phone.replace(/\D/g, '') === normalizedNewPhone
    );

    if (isDuplicatePhone) {
      showNotification('Error: A client with this mobile number already exists', 'error');
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');

    try {
        if (isEditModalOpen && formData.id) {
          const updatedClient: Customer = { ...formData, phone: fullPhone, instanceId: currentUser.instanceId };
          await updateCustomerInDB(updatedClient);
          setCustomers(prev => prev.map(c => c.id === formData.id ? updatedClient : c));
          if (selectedCustomer?.id === formData.id) setSelectedCustomer(updatedClient);
          setIsEditModalOpen(false);
          setIsAddModalOpen(false);
          showNotification('Profile updated successfully');
        } else {
          const { countryCode, ...rest } = formData;
          const newClient: Customer = {
            ...rest,
            id: `c-${Date.now()}`,
            phone: fullPhone,
            createdAt: dateStr,
            totalOrders: 0,
            balance: 0,
            instanceId: currentUser.instanceId
          };
          await addCustomerToDB(newClient);
          setCustomers(prev => [newClient, ...prev]);
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
          showNotification('Client registered successfully');
        }
    } catch (err) {
        showNotification('Cloud sync failed', 'error');
    }

    setFormData({
      name: '', countryCode: '+91', phone: '', firmId: '', nickname: '', type: 'Owner',
      status: 'Approved', market: '', password: '', pincode: '', city: '', state: '', address: ''
    });
  };

  const firmGroup = useMemo(() => {
    if (!selectedCustomer) return [];
    if (!selectedCustomer.firmId) return [selectedCustomer];
    return customers.filter(c => c.firmId === selectedCustomer.firmId);
  }, [selectedCustomer, customers]);

  const sharedFirmBalance = useMemo(() => {
    if (!selectedCustomer) return 0;
    return firmGroup.reduce((sum, c) => sum + Number(c.balance || 0), 0);
  }, [selectedCustomer, firmGroup]);

  const firmLedger = useMemo(() => {
    if (!selectedCustomer) return [];
    
    const ledger = allOrders.filter(o => {
      // RULE: Exclude explicitly rejected orders from statement/ledger
      if (o.status === 'rejected') return false;

      return firmGroup.some(member => 
        (o.customerId && o.customerId === member.id) || 
        (!o.customerId && o.customerName === member.name && (o.customerSubtext === member.city || o.customerSubtext === selectedCustomer.address || o.customerSubtext === selectedCustomer.city))
      );
    }).sort((a, b) => parseOrderDate(b.orderTime) - parseOrderDate(a.orderTime));

    if (ledgerLimit === 'All') return ledger;
    return ledger.slice(0, Number(ledgerLimit));
  }, [allOrders, selectedCustomer, firmGroup, ledgerLimit]);

  const handleRowClick = (order: Order) => {
    if (order.status === 'Return') {
      const stored = localStorage.getItem(`apexflow_gr_items_${order.id}`);
      if (stored) {
        const grData = JSON.parse(stored);
        setPreviewOrderItems(grData.map((g: any, idx: number) => ({
          id: `gr-${idx}`,
          brand: g.item.brand,
          quality: g.item.quality,
          model: g.item.model,
          orderQty: g.returnQty,
          fulfillQty: g.returnQty,
          finalPrice: g.returnPrice,
          category: g.item.category || 'APEXFLOW'
        })));
      } else setPreviewOrderItems([]);
    } else if (order.status === 'Payment') {
      setPreviewOrderItems([]);
    } else {
      const items = order.items || [];
      if (items.length === 0) {
        const stored = localStorage.getItem(`apexflow_items_${order.id}`);
        setPreviewOrderItems(stored ? JSON.parse(stored) : []);
      } else setPreviewOrderItems(items);
    }
    setViewingTransaction(order);
    setIsInvoiceModalOpen(true);
  };

  const handleGeneratePDF = () => {
    if (!statementRef.current) return;
    const element = statementRef.current;
    const opt = {
      margin: [10, 10],
      filename: `Statement_${selectedCustomer?.name}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    (window as any).html2pdf().set(opt).from(element).save();
    showNotification('Generating PDF...');
  };

  const handleOpenEdit = (customer: Customer) => {
    let phonePart = customer.phone;
    let codePart = '+91';
    const matchedCode = COUNTRY_CODES.find(c => customer.phone.startsWith(c.code));
    if (matchedCode) {
      codePart = matchedCode.code;
      phonePart = customer.phone.replace(matchedCode.code, '').trim();
    }
    setFormData({ ...customer, countryCode: codePart, phone: phonePart });
    setIsEditModalOpen(true);
  };

  const handleOpenProfile = (customer: Customer) => {
    setSelectedCustomer(customer);
    setLedgerLimit(50);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !paymentForm.amount) return;
    const amount = parseFloat(paymentForm.amount);
    const netAdjustment = paymentForm.type === 'Add' ? amount : -amount;
    
    try {
        const updatedCustomer = { ...selectedCustomer, balance: Number(selectedCustomer.balance) + netAdjustment };
        await updateCustomerInDB(updatedCustomer);
        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? updatedCustomer : c));
        setSelectedCustomer(updatedCustomer);

        const now = new Date();
        const dateStr = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
        
        const paymentLog: Order = { 
          id: `PAY-${Date.now()}`, 
          customerId: selectedCustomer.id, 
          customerName: selectedCustomer.name, 
          customerSubtext: selectedCustomer.city,
          orderTime: dateStr, 
          status: 'Payment', 
          totalAmount: netAdjustment,
          warehouse: paymentForm.type === 'Add' ? 'Financial Credit' : 'Financial Debit',
          invoiceStatus: 'Paid',
          orderMode: 'Offline',
          remarks: paymentForm.remarks || (paymentForm.type === 'Add' ? 'Manual credit add' : 'Manual debit deduction'),
          instanceId: currentUser.instanceId // INJECT INSTANCE ID
        };
        
        await addOrderToDB(paymentLog);
        setAllOrders(prev => [paymentLog, ...prev]);
        setIsPaymentModalOpen(false);
        setPaymentForm({ amount: '', mode: 'Cash', remarks: '', type: 'Add' });
        showNotification(paymentForm.type === 'Add' ? `₹${amount} added to balance` : `₹${amount} deducted from balance`, 'success');
    } catch (err) {
        showNotification('Payment sync failed', 'error');
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        (c.city && c.city.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [customers, searchTerm, statusFilter]);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCustomers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const rangeStart = filteredCustomers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const rangeEnd = Math.min(currentPage * itemsPerPage, filteredCustomers.length);

  const inputClass = "w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold uppercase outline-none focus:bg-white focus:border-indigo-500 transition-all placeholder-slate-300 shadow-inner";
  const labelClass = "block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2";

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500 pb-10">
      
      {/* Top Controls Strip */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 px-1 no-print">
        <div className="flex flex-1 items-center gap-3 w-full">
          <div className="relative flex-1 group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" size={20} strokeWidth={2.5} />
            <input
              type="text"
              placeholder="Search clients by name, phone or city..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-14 pr-8 py-4 bg-white border border-slate-200 rounded-[2.5rem] text-[13px] font-bold uppercase tracking-tight text-slate-800 outline-none focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all shadow-sm placeholder-slate-300"
            />
          </div>
          <div className="relative min-w-[160px]">
            <select 
              value={statusFilter} 
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="appearance-none w-full pl-10 pr-10 py-4 bg-white border border-slate-200 rounded-[2.5rem] text-[10px] font-black uppercase tracking-widest outline-none focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
            </select>
            <Filter size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <button onClick={handleRefresh} className="p-4 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-indigo-600 shadow-sm transition-all active:rotate-180 duration-700">
            <RefreshCw size={20} strokeWidth={2.5} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => {
            setFormData({
              name: '', countryCode: '+91', phone: '', firmId: '', nickname: '', type: 'Owner',
              status: 'Approved', market: '', password: '', pincode: '', city: '', state: '', address: ''
            });
            setIsAddModalOpen(true);
            setIsEditModalOpen(false);
          }} className="flex-1 lg:flex-none flex items-center justify-center px-10 py-4 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:shadow-indigo-300 transition-all active:scale-95 whitespace-nowrap">
            <Plus size={16} className="mr-2" strokeWidth={4} /> Register Client
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm no-print flex flex-col">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left table-fixed min-w-[1100px]">
            <thead>
              <tr className="table-header bg-slate-50/80 border-b border-slate-100">
                <th className="w-[22%] px-6 py-4 text-[9px] font-black uppercase tracking-wider text-slate-400">Client Identity</th>
                <th className="w-[15%] px-4 py-4 text-[9px] font-black uppercase tracking-wider text-slate-400">Contact</th>
                <th className="w-[10%] px-4 py-4 text-[9px] font-black uppercase tracking-wider text-slate-400">Firm Link</th>
                <th className="w-[10%] px-4 py-4 text-[9px] font-black uppercase tracking-wider text-slate-400 text-center">Status</th>
                <th className="w-[15%] px-4 py-4 text-[9px] font-black uppercase tracking-wider text-slate-400">Location</th>
                <th className="w-[13%] px-4 py-4 text-[9px] font-black uppercase tracking-wider text-slate-400">Registered At</th>
                <th className="w-[15%] px-4 py-4 text-[9px] font-black uppercase tracking-wider text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="py-24 text-center"><Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} /></td></tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr><td colSpan={7} className="py-24 text-center text-slate-300 font-bold uppercase">No records found</td></tr>
              ) : (
                paginatedCustomers.map((customer) => (
                  <tr key={customer.id} className="group hover:bg-slate-50/50 transition-all cursor-pointer" onClick={() => handleOpenProfile(customer)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs shrink-0 shadow-sm">{customer.name.charAt(0)}</div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-black text-slate-800 uppercase tracking-tight truncate leading-none mb-1">{customer.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{customer.phone || 'Individual'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4"><span className="text-[12px] font-bold text-slate-600 tracking-tight">{customer.phone}</span></td>
                    <td className="px-4 py-4">
                      {customer.firmId ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-[8px] font-black uppercase tracking-widest"><Building size={10}/> {customer.firmId}</span>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic">Personal</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${customer.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{customer.status}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin size={11} className="text-slate-300 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-500 uppercase truncate tracking-tight">{customer.city}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays size={11} className="text-slate-300 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{customer.createdAt || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => onCreateOrder?.(customer)} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-all" title="New Order"><ShoppingCart size={14} strokeWidth={3} /></button>
                        <button onClick={() => { setSelectedCustomer(customer); setPaymentForm(prev => ({...prev, type: 'Add'})); setIsPaymentModalOpen(true); }} className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-lg transition-all" title="Add Payment"><CreditCard size={14} strokeWidth={3} /></button>
                        <button onClick={() => handleOpenEdit(customer)} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all" title="Edit Profile"><Pencil size={14} strokeWidth={3} /></button>
                        <button onClick={() => handleOpenProfile(customer)} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all" title="View Profile"><Eye size={14} strokeWidth={3} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Strip */}
        {!loading && filteredCustomers.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
             <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rows per page</span>
                  <div className="relative">
                    <select 
                      value={itemsPerPage} 
                      onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                      className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-1.5 pr-8 text-[11px] font-black text-slate-700 outline-none focus:border-indigo-500 shadow-sm cursor-pointer"
                    >
                      {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Showing <span className="text-slate-900">{rangeStart} - {rangeEnd}</span> of <span className="text-slate-900">{filteredCustomers.length}</span> Clients
                </div>
             </div>
              <div className="flex items-center gap-1.5">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-all"><ChevronLeft size={16} strokeWidth={3}/></button>
                <div className="flex items-center gap-1">{Array.from({length: Math.min(5, totalPages)}, (_, i) => (<button key={i+1} onClick={() => setCurrentPage(i+1)} className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${currentPage === i+1 ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>{i+1}</button>))}</div>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-all"><ChevronRight size={16} strokeWidth={3}/></button>
              </div>
          </div>
        )}
      </div>

      {/* --- PROFILE FULLSCREEN VIEW --- */}
      {selectedCustomer && !isEditModalOpen && (
        <div className="fixed inset-0 bg-white z-[60] overflow-y-auto flex flex-col animate-in slide-in-from-bottom-4 duration-300 print:static print:h-auto print:overflow-visible">
          <div className="sticky top-0 bg-white border-b border-slate-100 px-10 py-8 flex items-center justify-between z-10 no-print">
            <div className="flex items-center gap-8">
              <button onClick={() => setSelectedCustomer(null)} className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 shadow-sm transition-all active:scale-90"><X size={24} /></button>
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{selectedCustomer.name}</h2>
                <p className="text-[11px] font-black text-indigo-500 uppercase tracking-widest mt-1">Identity Node: {selectedCustomer.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => handleOpenEdit(selectedCustomer)} className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[12px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">Edit Identity</button>
              <button onClick={() => { setPaymentForm(prev => ({...prev, type: 'Add'})); setIsPaymentModalOpen(true); }} className="px-10 py-4 bg-emerald-600 text-white rounded-[1.5rem] font-black text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 transition-all active:scale-95 hover:bg-emerald-700">Add Payment</button>
            </div>
          </div>

          <div className="p-12 max-w-[1500px] mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-12 no-print">
            {/* Sidebar Stats Area */}
            <div className="lg:col-span-1 space-y-8">
              <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 shadow-inner">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-2"><UserCheck size={16}/> Essential Details</p>
                <div className="grid grid-cols-1 gap-6">
                  <div className="grid grid-cols-2 gap-6">
                    <DetailItem label="Contact Name" value={selectedCustomer.name} />
                    <DetailItem label="Alias" value={selectedCustomer.nickname || '-'} />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <DetailItem label="Firm ID" value={selectedCustomer.firmId || 'Personal Ledger'} icon={<Building size={12}/>}/>
                    <DetailItem label="Phone" value={selectedCustomer.phone} icon={<Phone size={12}/>}/>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <DetailItem label="Role" value={selectedCustomer.type} icon={<Briefcase size={12}/>}/>
                    <DetailItem label="Status" value={selectedCustomer.status} status />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <DetailItem label="Portal PIN" value={selectedCustomer.password || 'Not Set'} icon={<Lock size={12}/>}/>
                    <DetailItem label="City" value={selectedCustomer.city} />
                  </div>
                  <DetailItem label="Business Address" value={selectedCustomer.address || '-'} icon={<MapPinned size={12}/>} fullWidth />
                </div>
              </div>
              
              <div className="bg-indigo-600 p-12 rounded-[3rem] text-white flex flex-col justify-between shadow-2xl shadow-indigo-100 min-h-[280px] relative overflow-hidden group">
                <div className="relative z-10">
                    <p className="text-indigo-200 text-[10px] font-black uppercase tracking-[0.4em] mb-4">
                      {selectedCustomer.firmId ? 'Consolidated Firm Credit' : 'Total Individual Credit'}
                    </p>
                    <h3 className="text-6xl font-black tracking-tighter italic">₹{sharedFirmBalance.toFixed(1)}</h3>
                </div>
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full group-hover:scale-125 transition-transform duration-700"></div>
              </div>
            </div>
            
            {/* History Table Area */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm">
                <div className="px-10 py-8 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Order & Ledger History</h3>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Limit:</span>
                        <select value={ledgerLimit} onChange={(e) => setLedgerLimit(e.target.value === 'All' ? 'All' : Number(e.target.value))} className="bg-transparent text-[11px] font-black outline-none cursor-pointer">{LEDGER_LIMIT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>
                    </div>
                    <button onClick={() => setIsStatementModalOpen(true)} className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"><ReceiptText size={14} /> Statement</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead><tr className="border-b border-slate-50 text-[10px] uppercase text-slate-400 font-black"><th className="px-10 py-6">Ref ID</th><th className="px-10 py-6">Timestamp</th><th className="px-10 py-6">Type</th><th className="px-10 py-6 text-right">Adjustment</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {firmLedger.map((order: any) => {
                        const isDeduction = order.status === 'Payment' && order.totalAmount < 0;
                        const isCredit = (order.status === 'Payment' && order.totalAmount > 0) || order.status === 'Return';
                        const amt = Math.abs(order.totalAmount || 0);

                        return (
                          <tr key={order.id} onClick={() => handleRowClick(order)} className="text-sm hover:bg-slate-50 transition-colors cursor-pointer group">
                            <td className="px-10 py-6 font-black text-slate-900 text-[12px] tracking-tight group-hover:text-indigo-600">#{order.id.toString().slice(-10)}</td>
                            <td className="px-10 py-6 text-[12px] font-black text-slate-900 uppercase tracking-tight">{order.orderTime}</td>
                            <td className="px-10 py-6">
                              <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                                order.status === 'Payment' ? (isDeduction ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100') : 
                                order.status === 'Return' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                'bg-indigo-50 text-indigo-600 border-indigo-100'
                              }`}>{order.status.toUpperCase()}</span>
                            </td>
                            <td className={`px-10 py-6 text-right font-black tracking-widest text-[14px] ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {`${isCredit ? '+' : '-'}₹${amt.toFixed(1)}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT CLIENT MODAL --- */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl h-[95vh] md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95">
                
                {/* Header */}
                <div className="px-8 md:px-12 py-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-xl bg-[#4f46e5] text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                            <Pencil size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">{isEditModalOpen ? 'UPDATE CLIENT' : 'REGISTER CLIENT'}</h3>
                            <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5">IDENTIFY & PERMISSION PROTOCOL</p>
                        </div>
                    </div>
                    <button onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all shadow-sm">
                        <X size={20} />
                    </button>
                </div>
                
                <form onSubmit={handleSaveClient} className="flex-1 overflow-y-auto custom-scrollbar p-8 md:p-12 space-y-12 bg-white">
                    
                    <div className="flex flex-col lg:flex-row gap-12">
                        {/* LEFT COLUMN: IDENTITY PROFILE */}
                        <div className="flex-1 space-y-8">
                            <div className="flex items-center gap-2 mb-2">
                                <UserCircle className="text-indigo-500" size={18} />
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">IDENTITY PROFILE</h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className={labelClass}>BUSINESS IDENTITY <span className="text-rose-500">*</span></label>
                                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputClass} placeholder="JACK" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>ALIAS / NICKNAME</label>
                                    <input type="text" value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} className={inputClass} placeholder="NICKNAME..." />
                                </div>
                            </div>

                            <div className="flex flex-col gap-6">
                                <div className="space-y-2">
                                    <label className={labelClass}>CONTACT MOBILE <span className="text-rose-500">*</span></label>
                                    <div className="flex gap-2">
                                        <div className="relative min-w-[75px]">
                                            <select value={formData.countryCode} onChange={e => setFormData({...formData, countryCode: e.target.value})} className="w-full pl-3 pr-7 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-black appearance-none outline-none focus:border-indigo-500 transition-all">
                                                {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                        <div className="flex-1 relative">
                                            <Smartphone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                            <input required type="tel" maxLength={10} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} className={`${inputClass} pl-11 shadow-inner`} placeholder="1231231231" />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <label className={labelClass}>CONNECT TO FIRM (SHARED LEDGER)</label>
                                    <SearchableFirmSelect 
                                        firms={firms} 
                                        value={formData.firmId} 
                                        onChange={(val) => setFormData({...formData, firmId: val})} 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: CONTROL PARAMETERS CARD */}
                        <div className="w-full lg:w-[320px] bg-slate-50/50 rounded-[2rem] border border-slate-100 p-8 space-y-8">
                            <div className="flex items-center gap-2 mb-2">
                                <ShieldCheck className="text-indigo-500" size={18} />
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">CONTROL PARAMETERS</h4>
                            </div>

                            <div className="space-y-3">
                                <label className={labelClass}>CLIENT ROLE <span className="text-rose-500">*</span></label>
                                <div className="flex p-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                    <button type="button" onClick={() => setFormData({...formData, type: 'Owner'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'Owner' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>OWNER</button>
                                    <button type="button" onClick={() => setFormData({...formData, type: 'Agent'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'Agent' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>AGENT</button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className={labelClass}>ACCOUNT STATUS <span className="text-rose-500">*</span></label>
                                <div className="space-y-2">
                                    {['Approved', 'Pending', 'Rejected'].map(status => (
                                        <button 
                                            key={status}
                                            type="button"
                                            onClick={() => setFormData({...formData, status})}
                                            className={`w-full px-5 py-3 rounded-xl border flex items-center justify-between text-[11px] font-black uppercase tracking-widest transition-all ${
                                                formData.status === status 
                                                ? 'bg-white border-[#4f46e5] text-[#4f46e5] shadow-lg ring-1 ring-[#4f46e5]/10' 
                                                : 'bg-white border-slate-100 text-slate-400 opacity-60'
                                            }`}
                                        >
                                            {status}
                                            {formData.status === status && <CheckCircle2 size={16} />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className={labelClass}>PORTAL SECURITY PIN</label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input type="text" maxLength={4} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value.replace(/\D/g, '')})} className={`${inputClass} pl-11 bg-white py-3`} placeholder="123" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BOTTOM SECTION: GEOGRAPHY MAPPING */}
                    <div className="space-y-8 pt-8 border-t border-slate-50">
                        <div className="flex items-center gap-2 mb-2">
                            <MapPinned className="text-indigo-500" size={18} />
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">GEOGRAPHY MAPPING</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className={labelClass}>CITY <span className="text-rose-500">*</span></label>
                                <input required type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className={inputClass} placeholder="CITY NAME..." />
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>STATE</label>
                                <input type="text" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} className={inputClass} placeholder="STATE NAME..." />
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>PINCODE</label>
                                <input type="text" maxLength={6} value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value.replace(/\D/g, '')})} className={inputClass} placeholder="000000" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className={labelClass}>FULL BUSINESS ADDRESS</label>
                            <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className={`${inputClass} min-h-[120px] resize-none py-6 leading-relaxed`} placeholder="COMPLETE BILLING/SHIPPING ADDRESS..." />
                        </div>
                    </div>
                </form>

                <div className="px-8 md:px-12 py-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-6 shrink-0">
                    <button type="button" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} className="px-12 py-4 rounded-2xl bg-white border border-slate-200 text-slate-500 font-black text-[11px] uppercase tracking-[0.2em] shadow-sm hover:bg-slate-100 transition-all active:scale-95">DISCARD</button>
                    <button onClick={handleSaveClient} className="flex-1 py-4 bg-[#4f46e5] text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">SYNCHRONIZE CLIENT</button>
                </div>
            </div>
        </div>
      )}

      {/* --- PAYMENT MODAL --- */}
      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${paymentForm.type === 'Add' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                            {paymentForm.type === 'Add' ? <PlusCircle size={20} /> : <MinusCircle size={20} />}
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">{paymentForm.type === 'Add' ? 'Credit Inflow' : 'Debit Deduction'}</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Adjusting: {selectedCustomer.name}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsPaymentModalOpen(false)} className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:text-rose-500 transition-all shadow-sm"><X size={20} /></button>
                </div>
                
                <form onSubmit={handlePaymentSubmit} className="p-10 space-y-8">
                    <div className="flex p-1.5 bg-slate-100 rounded-3xl border border-slate-200">
                        <button type="button" onClick={() => setPaymentForm({...paymentForm, type: 'Add'})} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentForm.type === 'Add' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}`}>Payment Received</button>
                        <button type="button" onClick={() => setPaymentForm({...paymentForm, type: 'Remove'})} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentForm.type === 'Remove' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400'}`}>Debit Adjustment</button>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Transaction Amount</label>
                        <div className="relative">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-2xl">₹</span>
                            <input required autoFocus type="number" step="0.1" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full pl-14 pr-6 py-6 bg-slate-50 border border-slate-200 rounded-3xl text-3xl font-black outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner" placeholder="0.00" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Transaction Remarks</label>
                        <textarea value={paymentForm.remarks} onChange={e => setPaymentForm({...paymentForm, remarks: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[12px] font-bold uppercase outline-none focus:bg-white focus:border-indigo-500 transition-all min-h-[120px] resize-none shadow-inner" placeholder="OPTIONAL NOTE..."></textarea>
                    </div>

                    <div className="flex gap-4 pt-2">
                        <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95">Discard</button>
                        <button type="submit" className={`flex-[2] py-4 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 ${paymentForm.type === 'Add' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'}`}>Finalize Transaction</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* --- PROFESSIONAL INVOICE MODAL (SHARED WITH ORDER DETAILS) --- */}
      {isInvoiceModalOpen && viewingTransaction && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[200] flex items-center justify-center p-2 md:p-4 overflow-y-auto print:p-0 print:static print:bg-white animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-slate-100 print:shadow-none print:border-none print:rounded-none animate-in zoom-in-95">
                <div className="px-4 md:px-6 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50 no-print">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
                        {viewingTransaction.status === 'Payment' ? 'Payment Voucher' : (viewingTransaction.status === 'Return' ? 'Credit Note' : 'Invoice Preview')} - #{viewingTransaction.id.toString().slice(-8)}
                    </span>
                    <button onClick={() => { setIsInvoiceModalOpen(false); setViewingTransaction(null); }} className="text-slate-400 hover:text-rose-600 transition-colors p-1">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 p-2 md:p-6 print:p-0 bg-gray-50 flex justify-center no-scrollbar print:bg-white overflow-y-auto custom-scrollbar">
                    <div className="bg-white w-full max-w-[650px] min-h-[700px] shadow-sm p-6 md:p-10 border border-slate-200 print:shadow-none print:border-none print:p-8 font-sans text-slate-900 flex flex-col">
                        
                        <div className="text-center mb-8 md:mb-10">
                            <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900">{superAdminName}</h1>
                            <div className="h-0.5 w-24 bg-slate-900 mx-auto mt-1"></div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3">Verified Distribution Node</p>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-start mb-8 md:mb-10 text-[11px] md:text-[12px] gap-6">
                            <div className="space-y-2">
                                <p className="text-slate-400 font-black uppercase tracking-widest text-[9px]">Account Holder</p>
                                <div>
                                    <p className="font-black text-base text-slate-900 uppercase tracking-tight">{viewingTransaction.customerName}</p>
                                    {selectedCustomer?.phone && <p className="text-slate-800 font-black mt-1 text-[11px] leading-tight">M: {selectedCustomer.phone}</p>}
                                </div>
                            </div>
                            <div className="text-left sm:text-right space-y-2 w-full sm:w-auto">
                                <div className="space-y-1">
                                    <p className="text-slate-400 font-black uppercase tracking-widest text-[9px]">Document Info</p>
                                    <p className="font-bold text-slate-600 uppercase">Date : <span className="text-slate-900 font-black">{viewingTransaction.orderTime.split(' ')[0]}</span></p>
                                    <p className="font-bold text-slate-600 uppercase">Ref : <span className="text-slate-900 font-black">#{viewingTransaction.id.toString().slice(-10)}</span></p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full border-collapse min-w-[450px]">
                                <thead>
                                    <tr className="border-y-2 border-slate-900">
                                        <th className="py-2 px-1 text-left text-[10px] font-black uppercase tracking-widest text-slate-900">Description</th>
                                        {previewOrderItems.length > 0 && (
                                            <>
                                                <th className="py-2 px-1 text-center text-[10px] font-black uppercase tracking-widest text-slate-900 w-12">Qty</th>
                                                <th className="py-2 px-1 text-center text-[10px] font-black uppercase tracking-widest text-slate-900 w-20">Rate</th>
                                            </>
                                        )}
                                        <th className="py-2 px-1 text-right text-[10px] font-black uppercase tracking-widest text-slate-900 w-24">Impact</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {previewOrderItems.length > 0 ? (
                                        previewOrderItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                <td className="py-4 px-2">
                                                    <p className="text-[12px] font-black uppercase text-slate-800 leading-tight">
                                                        {item.brand} {item.quality} {item.category} {item.model}
                                                    </p>
                                                </td>
                                                <td className="py-2 px-1 text-center text-[12px] font-black text-slate-900">{item.fulfillQty || item.orderQty}</td>
                                                <td className="py-2 px-1 text-center text-[12px] font-bold text-slate-700">₹{item.finalPrice.toFixed(1)}</td>
                                                <td className="py-2 px-1 text-right text-[12px] font-black text-slate-900">₹{((item.fulfillQty || item.orderQty) * item.finalPrice).toFixed(1)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td className="py-8 px-1 text-[12px] font-black uppercase text-slate-800">
                                                {viewingTransaction.status === 'Payment' ? 'Credit/Debit Adjustment' : 'General Transaction'}
                                                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase italic tracking-widest">Entry from: {viewingTransaction.warehouse || 'System Console'}</p>
                                            </td>
                                            <td className="py-8 px-1 text-right text-[14px] font-black text-slate-900">₹{Math.abs(viewingTransaction.totalAmount || 0).toFixed(1)}</td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-900 text-white border-t-2 border-slate-900">
                                        <td colSpan={previewOrderItems.length > 0 ? 4 : 1} className="py-6 px-6">
                                            <div className="flex justify-between items-center text-sm font-black uppercase tracking-widest">
                                                {previewOrderItems.length > 0 && (
                                                    <div className="flex items-center gap-4">
                                                        <span className="opacity-60 text-[10px]">Total Qty:</span>
                                                        <span className="text-xl">
                                                            {previewOrderItems.reduce((s, i) => s + (i.fulfillQty || i.orderQty), 0)} PCS
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-4 ml-auto">
                                                    <span className="opacity-60 text-[10px]">Net Impact:</span>
                                                    <span className="text-3xl tracking-tighter italic font-black">
                                                        ₹{Math.abs(viewingTransaction.totalAmount || 0).toFixed(1)}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {viewingTransaction.remarks && (
                            <div className="mt-8 p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><MessageSquare size={10}/> Remark</p>
                                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tight leading-relaxed">{viewingTransaction.remarks}</p>
                            </div>
                        )}

                        <div className="text-center mt-6 md:mt-10 pt-6 border-t border-slate-100">
                            <h3 className="text-base font-black tracking-tight text-slate-800 uppercase">ApexFlow Secure Signature</h3>
                            <p className="text-[8px] font-black text-slate-400 mt-1 uppercase tracking-widest">Certified Digital Transaction Record.</p>
                        </div>
                    </div>
                </div>

                <div className="px-4 md:px-8 py-4 bg-white border-t border-slate-200 flex flex-wrap justify-center sm:justify-end gap-2 md:gap-3 no-print">
                    <button 
                        onClick={() => {
                            const summary = `*APEXFLOW VOUCHER - #${viewingTransaction.id}*\n*Client:* ${viewingTransaction.customerName}\n*Amount:* ₹${Math.abs(viewingTransaction.totalAmount || 0).toFixed(1)}\n*Type:* ${viewingTransaction.status.toUpperCase()}`;
                            navigator.clipboard.writeText(summary);
                            showNotification('Summary Copied');
                        }}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                    >
                        <Share2 size={14} /> Share
                    </button>
                    <button 
                        onClick={() => window.print()}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95"
                    >
                        <Printer size={14} /> Print
                    </button>
                    <button 
                        onClick={() => { setIsInvoiceModalOpen(false); setViewingTransaction(null); }}
                        className="w-full sm:auto px-6 py-2 bg-white border border-slate-300 text-slate-500 hover:bg-slate-50 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- ACCOUNT STATEMENT MODAL (PROFESSIONAL POPUP) --- */}
      {isStatementModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] flex flex-col items-center justify-start overflow-y-auto p-4 md:p-10 no-print animate-in fade-in duration-300">
            {/* Dark Mode Style Toolbar */}
            <div className="w-full max-w-4xl bg-slate-800 rounded-t-[2rem] border-x border-t border-slate-700 px-6 md:px-10 py-4 flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                        <FileIcon size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-white text-sm font-black uppercase tracking-tight leading-none">Account Statement</h2>
                        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-1.5">PDF Digital Verification Mode</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleGeneratePDF}
                        className="p-3 bg-slate-700 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-90"
                        title="Download as PDF"
                    >
                        <Download size={20} strokeWidth={2.5} />
                    </button>
                    <button 
                        onClick={() => window.print()}
                        className="p-3 bg-slate-700 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-90"
                        title="Print Document"
                    >
                        <Printer size={20} strokeWidth={2.5} />
                    </button>
                    <div className="w-px h-6 bg-slate-700 mx-2"></div>
                    <button 
                        onClick={() => setIsStatementModalOpen(false)}
                        className="p-3 bg-slate-700 text-rose-400 hover:bg-rose-600 hover:text-white rounded-xl transition-all active:scale-90"
                    >
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>
            </div>

            {/* Document Surface */}
            <div className="w-full max-w-4xl bg-white shadow-2xl p-6 md:p-16 mb-20 border-x border-b border-slate-100 animate-in slide-in-from-bottom-5 duration-500 origin-top">
                <div id="statement-document" ref={statementRef} className="bg-white min-h-[1000px] flex flex-col">
                    
                    {/* Brand Header */}
                    <div className="flex justify-between items-start mb-14 border-b-2 border-slate-900 pb-8">
                        <div>
                            <h1 className="text-3xl font-black tracking-tighter uppercase text-slate-900 mb-1">{superAdminName}</h1>
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em]">Node Registry & Finance Core</p>
                            <div className="flex items-center gap-2 mt-6 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                                <MapPin size={12} className="text-slate-300" />
                                <span>Verified Transaction Node Dispatch Center</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className="text-2xl font-black tracking-tighter text-slate-900 uppercase">Statement</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Certified Digital Copy</p>
                            <p className="text-[12px] font-black text-slate-800 mt-6 uppercase">ID: ST-{(Date.now() % 1000000).toString()}</p>
                            <p className="text-[11px] font-bold text-slate-500 mt-1 uppercase">Date: {new Date().toLocaleDateString('en-GB')}</p>
                        </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-12 mb-16 p-10 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                        <div className="space-y-6">
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Statement Subject</p>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">{selectedCustomer.name}</h3>
                                <p className="text-[11px] font-bold text-slate-500 mt-3 uppercase tracking-tight">
                                    {selectedCustomer.city} | {selectedCustomer.phone}
                                </p>
                                {selectedCustomer.firmId && (
                                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-100 rounded-lg text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                                        <Building size={10} /> {selectedCustomer.firmId}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="text-right flex flex-col justify-between">
                            <div className="space-y-4">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Net Credit Balance</p>
                                <h3 className={`text-5xl font-black tracking-tighter italic ${sharedFirmBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    ₹{sharedFirmBalance.toFixed(1)}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verified Final Settlement</p>
                            </div>
                        </div>
                    </div>

                    {/* Statement Table */}
                    <div className="flex-1">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-y-2 border-slate-900 bg-slate-50">
                                    <th className="py-5 px-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-900">Ref ID</th>
                                    <th className="py-5 px-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-900">Date & Time</th>
                                    <th className="py-5 px-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-900">Type</th>
                                    <th className="py-5 px-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-900 w-28">Credit (+)</th>
                                    <th className="py-5 px-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-900 w-28">Debit (-)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {firmLedger.map((tx, idx) => {
                                    const isCredit = (tx.status === 'Payment' && (tx.totalAmount || 0) >= 0) || tx.status === 'Return';
                                    const amt = Math.abs(tx.totalAmount || 0);
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50/50">
                                            <td className="py-5 px-3 text-[11px] font-black text-slate-900 uppercase">#{tx.id.toString().slice(-10)}</td>
                                            <td className="py-5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-tighter">{tx.orderTime}</td>
                                            <td className="py-5 px-3">
                                                <span className={`text-[9px] font-black px-3 py-1 rounded-xl border uppercase tracking-widest ${isCredit ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                    {tx.status}
                                                </span>
                                            </td>
                                            <td className="py-5 px-3 text-right text-[13px] font-black text-emerald-600 tracking-tighter">{isCredit ? `₹${amt.toFixed(1)}` : '-'}</td>
                                            <td className="py-5 px-3 text-right text-[13px] font-black text-rose-600 tracking-tighter">{!isCredit ? `₹${amt.toFixed(1)}` : '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals Section */}
                    <div className="mt-14 pt-10 border-t-2 border-slate-900 flex justify-between items-center bg-slate-50 p-10 rounded-[2.5rem]">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
                                <ReceiptText size={24} />
                            </div>
                            <div>
                                <span className="text-sm font-black uppercase tracking-widest text-slate-900">Total Aggregated Credit Pool</span>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Across linked client entities</p>
                            </div>
                        </div>
                        <span className={`text-4xl font-black tracking-tighter italic ${sharedFirmBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            ₹{sharedFirmBalance.toFixed(1)}
                        </span>
                    </div>

                    {/* Professional Sign-off */}
                    <div className="mt-20 pt-10 border-t border-slate-100 flex justify-between items-end">
                        <div className="max-w-xs space-y-4">
                            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <Info size={14} className="text-indigo-500" /> Compliance Note
                            </h3>
                            <p className="text-[9px] text-slate-400 font-medium leading-relaxed uppercase tracking-tight">
                                This statement is a legal digital record of account activities. Generated via the ApexFlow Node. Unauthorized modification is strictly prohibited.
                            </p>
                        </div>
                        <div className="text-center">
                            <div className="w-48 h-16 border-b-2 border-slate-100 mb-4 relative flex items-center justify-center">
                                <p className="text-[10px] text-slate-200 font-black uppercase italic tracking-[0.3em]">SECURE SEAL</p>
                            </div>
                            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em]">Authorized Signatory</h3>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">ApexFlow Control Node</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const SearchableFirmSelect: React.FC<{ firms: Firm[], value: string, onChange: (val: string) => void }> = ({ firms, value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filtered = useMemo(() => {
        const baseOptions = [{ id: 'none', name: 'INDIVIDUAL LEDGER' }, ...firms];
        return baseOptions.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
    }, [firms, search]);

    const displayValue = useMemo(() => {
        if (!value) return 'INDIVIDUAL LEDGER';
        const found = firms.find(f => f.name === value);
        return found ? found.name : 'INDIVIDUAL LEDGER';
    }, [value, firms]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) inputRef.current.focus();
    }, [isOpen]);

    return (
        <div className="relative" ref={containerRef}>
            <div 
                onClick={() => setIsOpen(!isOpen)} 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold uppercase text-slate-800 flex items-center justify-between cursor-pointer hover:bg-white transition-all shadow-inner"
            >
                <span className={value ? 'text-slate-800' : 'text-slate-400'}>{displayValue}</span>
                <ChevronDown size={18} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-200 rounded-[2rem] shadow-2xl z-[160] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/5">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative group">
                            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                            <input 
                                ref={inputRef}
                                type="text" 
                                value={search} 
                                onChange={e => setSearch(e.target.value)} 
                                placeholder="Type to search firm..." 
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase outline-none focus:ring-4 focus:ring-indigo-50/10 transition-all" 
                            />
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar bg-white">
                        {filtered.length === 0 ? (
                            <div className="py-12 text-center text-slate-300 text-[10px] font-black uppercase tracking-widest">No matching firms</div>
                        ) : (
                            filtered.map(firm => (
                                <button 
                                    key={firm.id} 
                                    type="button" 
                                    onClick={() => { 
                                        onChange(firm.id === 'none' ? '' : firm.name); 
                                        setIsOpen(false); 
                                        setSearch(''); 
                                    }} 
                                    className={`w-full text-left px-7 py-3.5 hover:bg-indigo-50 transition-all flex items-center justify-between group ${value === (firm.id === 'none' ? '' : firm.name) ? 'bg-indigo-50/50' : ''}`}
                                >
                                    <span className={`text-xs font-black uppercase tracking-tight ${value === (firm.id === 'none' ? '' : firm.name) ? 'text-indigo-600' : 'text-slate-600 group-hover:text-indigo-600'}`}>
                                        {firm.name}
                                    </span>
                                    {value === (firm.id === 'none' ? '' : firm.name) && <Check size={14} className="text-indigo-600" strokeWidth={4} />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const DetailItem: React.FC<{ label: string; value: string; status?: boolean; icon?: React.ReactNode; fullWidth?: boolean }> = ({ label, value, status, icon, fullWidth }) => {
  const getStatusColor = (s: string) => {
    switch (s) {
      case 'Approved': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'Pending': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'Rejected': return 'text-rose-600 bg-rose-50 border-rose-100';
      default: return 'text-slate-500 bg-slate-50 border-slate-200';
    }
  };
  return (
    <div className={fullWidth ? 'col-span-full' : ''}>
      <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] block mb-2 flex items-center gap-2">{icon}{label}</label>
      {status ? (<span className={`inline-block px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${getStatusColor(value)}`}>{value}</span>) : (<p className="text-[13px] font-black text-slate-800 tracking-tight uppercase leading-relaxed">{value}</p>)}
    </div>
  );
};

export default Customers;
