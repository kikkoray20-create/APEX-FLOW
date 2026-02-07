import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    ArrowLeft, 
    RefreshCw, 
    Search, 
    Truck, 
    User, 
    Plus,
    X,
    RotateCcw,
    ArrowUp,
    ArrowDown,
    Pencil,
    CheckCircle2,
    UserCheck,
    ChevronRight,
    Check,
    Eye,
    Send,
    PlusCircle,
    Loader2,
    Printer,
    FileDown,
    Share2,
    Smartphone,
    ChevronUp,
    Ban,
    AlertTriangle,
    Package,
    ArrowRightCircle,
    Info,
    Lock,
    Square,
    CheckSquare,
    Users,
    Activity,
    Maximize2,
    RotateCw,
    Hand,
    Undo2,
    MoreVertical,
    ZoomIn,
    ZoomOut,
    Download,
    Menu as MenuIcon
} from 'lucide-react';
import { Order, OrderItem, User as UserType, OrderStatus, InventoryItem, Customer, InventoryLog } from '../types';
import { useNotification } from '../context/NotificationContext';
import { updateOrderInDB, fetchInventory, listenToOrderDetails, fetchCustomers, updateCustomerInDB, updateInventoryItemInDB, addInventoryLogToDB, fetchLinks, updateLinkInDB } from '../services/db';

interface OrderDetailProps {
  order: Order;
  onBack: () => void;
  currentUser: UserType;
  allUsers: UserType[];
  onUpdateStatus: (orderId: string, newStatus: OrderStatus, assignedToId?: string, assignedToName?: string, items?: OrderItem[]) => Promise<void>;
}

// Inner component for stable price editing
const StablePriceInput: React.FC<{ 
    value: number; 
    onSave: (val: number) => void;
    isLocked: boolean;
}> = ({ value, onSave, isLocked }) => {
    const [localValue, setLocalValue] = useState(value.toFixed(1));
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!isEditing) {
            setLocalValue(value.toFixed(1));
        }
    }, [value, isEditing]);

    const handleBlur = () => {
        setIsEditing(false);
        const parsed = parseFloat(localValue);
        if (!isNaN(parsed)) {
            // Clamped to 0 to prevent negative prices
            onSave(Math.max(0, parsed));
        } else {
            setLocalValue(value.toFixed(1));
        }
    };

    return (
        <input 
            type="text" 
            inputMode="decimal"
            disabled={isLocked}
            value={localValue} 
            onChange={(e) => {
                setIsEditing(true);
                const val = e.target.value.replace(/[^0-9.]/g, '');
                setLocalValue(val);
            }}
            onBlur={handleBlur}
            onKeyDown={(e) => { if(e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-24 h-10 border border-slate-200 bg-white rounded-lg text-center text-[13px] font-black text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
        />
    );
};

const OrderDetail: React.FC<OrderDetailProps> = ({ order, onBack, currentUser, allUsers, onUpdateStatus }) => {
  const { showNotification } = useNotification();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [liveOrder, setLiveOrder] = useState<Order>(order);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bulkLessValue, setBulkLessValue] = useState<string>('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isAddModelsModalOpen, setIsAddModelsModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
  const [isFulfillWarningOpen, setIsFulfillWarningOpen] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [customerPhone, setCustomerPhone] = useState<string>('');
  
  // Invoice Viewer States
  const [zoomLevel, setZoomLevel] = useState(100);
  const invoiceDocRef = useRef<HTMLDivElement>(null);

  const isStaff = currentUser && ['Picker', 'Checker', 'Dispatcher'].includes(currentUser.role);
  
  // LOGIC: Allow Super Admin to edit 'checked' and 'dispatched' orders, but block Staff. 
  // 'Add' and 'Assign' buttons stay locked for everyone once the order is checked/dispatched.
  const isAddAssignLocked = liveOrder?.status === 'checked' || liveOrder?.status === 'dispatched' || isStaff;
  const isModificationLocked = isStaff && (liveOrder?.status === 'checked' || liveOrder?.status === 'dispatched');

  // isDirty checks if any line has been processed or modified
  const isDirty = useMemo(() => items.some(item => item.fulfillQty > 0 || item.finalPrice !== item.displayPrice), [items]);

  const [isEditingCargo, setIsEditingCargo] = useState(false);
  const [cargoDraft, setCargoDraft] = useState(order.cargoName || '');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [addModelsSearch, setAddModelsSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof OrderItem; direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: keyof OrderItem) => {
    setSortConfig(prev => {
        if (prev?.key === key) {
            return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
        }
        return { key, direction: 'asc' };
    });
  };

  const superAdminName = useMemo(() => {
    const admin = allUsers.find(u => u.role === 'Super Admin');
    return admin ? admin.name : 'APEXFLOW MANAGEMENT';
  }, [allUsers]);

  useEffect(() => {
    if (order.id) {
        const unsubscribe = listenToOrderDetails(order.id, (updatedOrder) => {
            setLiveOrder(updatedOrder);
            if (updatedOrder.items && updatedOrder.items.length > 0) setItems(updatedOrder.items);
            if (updatedOrder.cargoName) setCargoDraft(updatedOrder.cargoName);
        });
        return () => unsubscribe();
    }
  }, [order.id]);

  useEffect(() => {
    if (order.items && order.items.length > 0) setItems(order.items);
  }, [order.items, order.id]);

  // Fetch customer phone for invoice
  useEffect(() => {
    const getPhone = async () => {
        const custs = await fetchCustomers(currentUser.instanceId);
        const match = custs.find(c => c.id === liveOrder.customerId || c.name === liveOrder.customerName);
        if (match) setCustomerPhone(match.phone);
    };
    if (liveOrder.customerName) getPhone();
  }, [liveOrder.customerName, liveOrder.customerId, currentUser.instanceId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setSortConfig(null);
    setSearchTerm('');
    setBulkLessValue('');
    setTimeout(() => { setIsRefreshing(false); showNotification('Order view refreshed'); }, 800);
  };

  const handleSaveCargo = async () => {
    try {
      const updatedOrder = { ...liveOrder, cargoName: cargoDraft, items };
      await updateOrderInDB(updatedOrder);
      setIsEditingCargo(false);
      showNotification('Cargo name updated');
    } catch (err) { showNotification('Failed to update cargo', 'error'); }
  };

  const handleStatusProgress = async () => {
    if (isStatusUpdating || liveOrder.status === 'fresh') return;
    setIsStatusUpdating(true);
    const statusMap: Record<OrderStatus, OrderStatus> = {
        'fresh': 'assigned', 'assigned': 'packed', 'packed': 'checked', 'checked': 'dispatched',
        'dispatched': 'dispatched', 'pending': 'assigned', 'cancelled': 'fresh', 'rejected': 'fresh',
        'Payment': 'Payment', 'Return': 'Return'
    };
    const nextStatus = statusMap[liveOrder.status] || liveOrder.status;
    try { 
        // CRITICAL: Pass current items to onUpdateStatus to ensure inventory deduction uses latest data
        await onUpdateStatus(liveOrder.id, nextStatus, undefined, undefined, items); 
        if (isStaff) setTimeout(onBack, 500); 
    } finally { 
        setIsStatusUpdating(false); 
    }
  };

  const toggleItemCheck = (id: string) => setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));

  const handleAssignPicker = async (picker: UserType) => {
    if (isAddAssignLocked || isStaff) return;
    const targetStatus = (liveOrder.status === 'fresh' || liveOrder.status === 'rejected') ? 'assigned' : liveOrder.status;
    await onUpdateStatus(liveOrder.id, targetStatus, picker.id, picker.name, items);
    setIsAssignModalOpen(false);
    showNotification(`Order assigned to ${picker.name}`);
  };

  const handleRejectOrder = async () => {
    if (isStaff) return;
    setIsRejectConfirmOpen(false);
    setIsStatusUpdating(true);
    try { 
        await onUpdateStatus(liveOrder.id, 'rejected', undefined, undefined, items); 
        showNotification('Order Rejected Successfully', 'error'); 
        setTimeout(() => onBack(), 500); 
    } catch (err) {
        showNotification('Failed to reject order', 'error');
    } finally { 
        setIsStatusUpdating(false); 
    }
  };

  const totalInvoiceAmount = useMemo(() => items.reduce((s, i) => s + ((i.fulfillQty || 0) * (i.finalPrice || 0)), 0), [items]);

  const syncPortalVisibility = async (itemId: string, newQty: number) => {
      if (newQty <= 0) {
          try {
              const allLinks = await fetchLinks(currentUser.instanceId);
              const updatePromises = allLinks.map(link => {
                  const currentAllowed = link.allowedModels || [];
                  const nextAllowed = currentAllowed.filter(id => id !== itemId);
                  if (nextAllowed.length !== currentAllowed.length) {
                      return updateLinkInDB({ ...link, allowedModels: nextAllowed });
                  }
                  return null;
              }).filter(p => p !== null);
              
              if (updatePromises.length > 0) {
                  await Promise.all(updatePromises);
                  console.log(`System: Item ${itemId} auto-removed from portals due to zero stock`);
              }
          } catch (e) {
              console.error("Portal sync failed during item edit", e);
          }
      }
  };

  const reconcileBalance = async (newItems: OrderItem[]) => {
      const isBilled = liveOrder.status === 'checked' || liveOrder.status === 'dispatched';
      if (!isBilled) return;
      const newTotal = newItems.reduce((sum, item) => sum + (item.fulfillQty * item.finalPrice), 0);
      const delta = newTotal - (liveOrder.billedAmount || 0);
      if (delta === 0) return;
      try {
          const allCusts = await fetchCustomers(currentUser.instanceId);
          const cust = allCusts.find(c => (liveOrder.customerId && c.id === liveOrder.customerId) || (!liveOrder.customerId && c.name === liveOrder.customerName && (c.city === liveOrder.customerSubtext || c.address === liveOrder.customerSubtext)));
          if (cust) {
              const newBalance = Number(cust.balance) - delta;
              await updateCustomerInDB({ ...cust, balance: newBalance });
              const updatedOrder = { ...liveOrder, items: newItems, totalAmount: newTotal, billedAmount: newTotal };
              await updateOrderInDB(updatedOrder);
              showNotification(`Balance adjusted by ₹${delta.toFixed(1)}`, 'info');
          }
      } catch (e) { console.error("Balance reconciliation failed", e); }
  };

  const updateItem = async (id: string, field: keyof OrderItem, value: any) => {
      let finalValue = value;
      if (field === 'fulfillQty' || field === 'finalPrice' || field === 'orderQty') finalValue = Math.max(0, value);
      
      const oldItem = items.find(i => i.id === id);
      if (!oldItem) return;

      const isBilled = liveOrder.status === 'checked' || liveOrder.status === 'dispatched';
      
      // SYNC INVENTORY: If Qty changes in a Billed Order
      if (field === 'fulfillQty' && isBilled) {
          const delta = finalValue - oldItem.fulfillQty;
          if (delta !== 0) {
              try {
                  const currentInventory = await fetchInventory(currentUser.instanceId);
                  const invItem = currentInventory.find(i => 
                      i.brand.toUpperCase() === oldItem.brand.toUpperCase() && 
                      i.model.toUpperCase() === oldItem.model.toUpperCase() &&
                      i.quality.toUpperCase() === oldItem.quality.toUpperCase()
                  );

                  if (invItem) {
                      const newStock = invItem.quantity - delta;
                      await updateInventoryItemInDB({ ...invItem, quantity: newStock });
                      
                      // Auto-remove from portals if stock hits 0 or less
                      await syncPortalVisibility(invItem.id, newStock);

                      const now = new Date();
                      const timestamp = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
                      
                      const log: InventoryLog = {
                          id: `edit-log-${Date.now()}-${invItem.id}`,
                          itemId: invItem.id,
                          modelName: `${invItem.brand} ${invItem.model} ${invItem.quality}`,
                          shopName: liveOrder.customerName,
                          status: delta > 0 ? 'Removed' : 'Added',
                          quantityChange: Math.abs(delta),
                          totalQuantity: Math.abs(delta),
                          itemCount: 1,
                          currentStock: newStock,
                          remarks: `Manual Edit Correction (Order #${liveOrder.id})`,
                          createdDate: timestamp,
                          customerName: liveOrder.customerName
                      };
                      await addInventoryLogToDB(log);
                      showNotification(`Stock ${delta > 0 ? 'reduced' : 'returned'} by ${Math.abs(delta)} pcs`, 'info');
                  }
              } catch (e) { console.error("Inventory reconcile failed", e); }
          }
      }

      const updated = items.map(i => i.id === id ? { ...i, [field]: finalValue } : i);
      setItems(updated);
      const newTotal = updated.reduce((sum, item) => sum + (item.fulfillQty * item.finalPrice), 0);
      const updatedOrder = { ...liveOrder, items: updated, totalAmount: newTotal };
      await updateOrderInDB(updatedOrder);
      await reconcileBalance(updated);
  };

  const handleFulfillAllClick = () => {
      if (isModificationLocked || isStaff) return;
      if (isDirty) setIsFulfillWarningOpen(true);
      else executeFulfillAll();
  };

  const executeFulfillAll = async () => {
      if (isModificationLocked || isStaff) return;
      
      const isBilled = liveOrder.status === 'checked' || liveOrder.status === 'dispatched';
      
      // If billed, we must iterate and sync inventory one by one to handle delta
      if (isBilled) {
          const currentInventory = await fetchInventory(currentUser.instanceId);
          const now = new Date();
          const timestamp = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

          for (const i of items) {
              const delta = i.orderQty - i.fulfillQty;
              if (delta === 0) continue;

              const invItem = currentInventory.find(inv => 
                  inv.brand.toUpperCase() === i.brand.toUpperCase() && 
                  inv.model.toUpperCase() === i.model.toUpperCase() &&
                  inv.quality.toUpperCase() === i.quality.toUpperCase()
              );

              if (invItem) {
                  const newStock = invItem.quantity - delta;
                  await updateInventoryItemInDB({ ...invItem, quantity: newStock });
                  
                  // Auto-remove from portals if stock hits 0 or less
                  await syncPortalVisibility(invItem.id, newStock);

                  await addInventoryLogToDB({
                      id: `bulk-edit-${Date.now()}-${invItem.id}`,
                      itemId: invItem.id,
                      modelName: `${invItem.brand} ${invItem.model} ${invItem.quality}`,
                      shopName: liveOrder.customerName,
                      status: delta > 0 ? 'Removed' : 'Added',
                      quantityChange: Math.abs(delta),
                      totalQuantity: Math.abs(delta),
                      itemCount: 1,
                      currentStock: newStock,
                      remarks: `Bulk Fulfill Protocol (Order #${liveOrder.id})`,
                      createdDate: timestamp,
                      customerName: liveOrder.customerName
                  });
              }
          }
      }

      const updated = items.map(i => ({ ...i, fulfillQty: i.orderQty, finalPrice: i.displayPrice }));
      setItems(updated);
      setIsFulfillWarningOpen(false);
      const newTotal = updated.reduce((sum, item) => sum + (item.fulfillQty * item.finalPrice), 0);
      const updatedOrder = { ...liveOrder, items: updated, totalAmount: newTotal };
      await updateOrderInDB(updatedOrder);
      await reconcileBalance(updated);
      showNotification('All items fulfilled and synced');
  };

  const handleApplyBulkLess = async () => {
      if (isStaff || isModificationLocked) return;
      const rawInput = parseFloat(bulkLessValue);
      if (isNaN(rawInput) || rawInput < 0) { showNotification('Enter a valid amount', 'info'); return; }
      const reduction = rawInput / 10;
      const updated = items.map(i => ({ ...i, finalPrice: Math.max(0, parseFloat((i.finalPrice - reduction).toFixed(1))) }));
      setItems(updated);
      const newTotal = updated.reduce((sum, item) => sum + (item.fulfillQty * item.finalPrice), 0);
      const updatedOrder = { ...liveOrder, items: updated, totalAmount: newTotal };
      await updateOrderInDB(updatedOrder);
      await reconcileBalance(updated);
      setBulkLessValue('');
      showNotification(`Applied ₹${reduction.toFixed(1)} bulk reduction`);
  };

  const filteredAndSortedItems = useMemo(() => {
    let result = items.filter(item => item.model.toLowerCase().includes(searchTerm.toLowerCase()) || item.brand.toLowerCase().includes(searchTerm.toLowerCase()));
    if (sortConfig) {
        result = [...result].sort((a, b) => {
            const valA = a[sortConfig.key!]; const valB = b[sortConfig.key!];
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            return sortConfig.direction === 'asc' ? 1 : -1;
        });
    }
    return result;
  }, [items, searchTerm, sortConfig]);

  const totalFulfilledQty = useMemo(() => items.reduce((s, i) => s + (i.fulfillQty || 0), 0), [items]);

  const HeaderSortIcon = ({ columnKey }: { columnKey: keyof OrderItem }) => {
    const isActive = sortConfig?.key === columnKey;
    return (
        <div className={`flex flex-col gap-0.5 ml-1.5 transition-opacity ${isActive ? 'opacity-100' : 'opacity-20 group-hover:opacity-50'}`}>
            <ArrowUp size={8} className={isActive && sortConfig.direction === 'asc' ? 'text-indigo-600' : ''} />
            <ArrowDown size={8} className={isActive && sortConfig.direction === 'desc' ? 'text-indigo-600' : ''} />
        </div>
    );
  };

  const handleAddModels = async () => {
    if (isAddAssignLocked || isStaff) return;
    setIsAddModelsModalOpen(true);
    setLoadingInventory(true);
    try { setInventory(await fetchInventory()); } finally { setLoadingInventory(false); }
  };

  const handleAddItemToOrder = async (invItem: InventoryItem) => {
    if (isAddAssignLocked || isStaff) return;
    if (items.some(i => i.brand === invItem.brand && i.model === invItem.model && i.quality === invItem.quality)) { showNotification('Already in order', 'info'); return; }
    const newItem: OrderItem = { id: `added-${Date.now()}`, brand: invItem.brand, quality: invItem.quality, category: invItem.category || 'APEXFLOW', model: invItem.model, orderQty: 1, displayPrice: invItem.price, fulfillQty: 0, finalPrice: invItem.price };
    const updatedItems = [newItem, ...items];
    setItems(updatedItems);
    const updatedOrder = { ...liveOrder, items: updatedItems, totalAmount: updatedItems.reduce((sum, item) => sum + (item.fulfillQty * item.finalPrice), 0) };
    await updateOrderInDB(updatedOrder);
    await reconcileBalance(updatedItems);
    showNotification(`${invItem.model} added`);
  };

  const handlePrintInvoice = () => {
    const originalTitle = document.title;
    document.title = `Invoice_${liveOrder.id}`;
    window.print();
    document.title = originalTitle;
  };

  const handleDownloadInvoice = () => {
    if (!invoiceDocRef.current) return;
    const element = invoiceDocRef.current;
    const opt = {
      margin: 10,
      filename: `Invoice_${liveOrder.id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    // @ts-ignore
    window.html2pdf().set(opt).from(element).save();
    showNotification('Generating PDF...');
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 10, 50));

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between no-print gap-4">
        <div className="flex items-center gap-3 md:gap-5">
          <button onClick={onBack} className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 shadow-sm transition-all active:scale-90 shrink-0"><ArrowLeft size={18} strokeWidth={2.5} /></button>
          <div>
            <div className="flex items-center gap-2"><h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">Order Details <span className="text-[#4f46e5]">#{liveOrder.id}</span></h2>{isStaff && (liveOrder.status === 'checked' || liveOrder.status === 'dispatched') && (<span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest border border-slate-200"><Lock size={10} /> FINALIZED</span>)}</div>
            <div className="flex items-center gap-2 mt-1">{!isStaff && (<button onClick={handleStatusProgress} disabled={(liveOrder.status === 'dispatched' && isStaff) || liveOrder.status === 'fresh' || liveOrder.status === 'rejected' || isStatusUpdating} className={`flex items-center gap-1.5 px-2 py-0.5 text-[8px] md:text-[9px] font-bold uppercase rounded border tracking-widest transition-all active:scale-90 hover:brightness-95 shadow-sm group ${liveOrder.status === 'fresh' ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : liveOrder.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-100 cursor-not-allowed' : liveOrder.status === 'dispatched' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-[#f5f3ff] text-[#4f46e5] border-[#e9e4ff]'}`}>{isStatusUpdating ? <Loader2 className="animate-spin" size={10} /> : <>{liveOrder.status === 'rejected' ? 'REJECTED' : (liveOrder.status === 'fresh' ? 'FREE' : liveOrder.status.toUpperCase())}{liveOrder.status !== 'fresh' && liveOrder.status !== 'rejected' && liveOrder.status !== 'dispatched' && <ArrowRightCircle size={10} className="group-hover:translate-x-0.5 transition-transform" />}{liveOrder.status === 'dispatched' && <Check size={10} />}</>}</button>)}<span className="text-[8px] md:text-[10px] font-medium text-slate-400 uppercase tracking-tight">{liveOrder.orderTime}</span></div>
          </div>
        </div>
        <div className="flex items-center gap-2">{liveOrder.status !== 'rejected' && !isStaff && (<button onClick={() => setIsRejectConfirmOpen(true)} disabled={isStatusUpdating || isModificationLocked} className="flex items-center gap-1.5 px-3 md:px-5 py-2 md:py-2.5 bg-rose-50 border border-rose-200 text-rose-500 rounded-xl font-bold text-[9px] md:text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-sm hover:bg-rose-100 disabled:opacity-50"><Ban size={14} className="shrink-0" /><span>REJECT</span></button>)}<button onClick={handleRefresh} className="p-2 md:p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-[#4f46e5] shadow-sm transition-all active:rotate-180 duration-500"><RefreshCw size={16} strokeWidth={2.5} className={isRefreshing ? 'animate-spin' : ''} /></button></div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl px-4 md:px-6 py-4 md:py-5 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-6 no-print">
        <div className="flex flex-col sm:flex-row gap-6 md:gap-12 items-center w-full lg:w-auto">
            <div className="flex items-center gap-4 w-full sm:auto min-w-[200px]"><div className="w-10 h-10 bg-indigo-50 text-[#4f46e5] rounded-xl flex items-center justify-center shrink-0"><User size={18} /></div><div className="flex-1 min-w-0 pr-2"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">CUSTOMER</p><p className="text-[13px] font-bold text-slate-800 uppercase truncate leading-tight">{liveOrder.customerName}</p><p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-none">{customerPhone || '•••• ••••'}</p></div></div>
            <div className="flex items-center gap-4 w-full sm:auto min-w-[240px]"><div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0"><Truck size={18} /></div><div className="flex-1 min-w-0 pr-2"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">CARGO NAME</p><div className="flex items-center gap-3">{isEditingCargo && !isStaff ? (<div className="flex items-center gap-1"><input type="text" value={cargoDraft} onChange={(e) => setCargoDraft(e.target.value)} className="w-24 px-2 py-0.5 border border-emerald-400 rounded text-xs font-semibold outline-none" autoFocus /><button onClick={handleSaveCargo} className="text-emerald-600 hover:text-emerald-700"><Check size={14} strokeWidth={3} /></button><button onClick={() => setIsEditingCargo(false)} className="text-rose-400 hover:text-rose-500"><X size={14} strokeWidth={3} /></button></div>) : (<p className="text-[13px] font-bold text-slate-800 truncate leading-tight">{liveOrder.cargoName || 'DEFAULT'}</p>)}{!isStaff && !isEditingCargo && !isModificationLocked && (<button onClick={() => setIsEditingCargo(true)} className="text-slate-300 hover:text-slate-500 transition-colors"><Pencil size={12} /></button>)}</div></div></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full lg:w-auto justify-center lg:justify-end">{!isStaff ? (<><button onClick={handleAddModels} disabled={isAddAssignLocked} className={`flex items-center gap-1.5 px-4 md:px-5 py-2.5 md:py-3.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold text-[10px] md:text-[11px] uppercase tracking-[0.1em] transition-all active:scale-95 ${isAddAssignLocked ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}><PlusCircle size={16} /> Add</button><button onClick={() => setIsInvoiceModalOpen(true)} className="flex items-center gap-1.5 px-4 md:px-5 py-2.5 md:py-3.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-bold text-[10px] md:text-[11px] uppercase tracking-[0.1em] transition-all active:scale-95"><Eye size={16} /> Invoice</button><button disabled={totalFulfilledQty === 0} onClick={() => { const summary = `*INVOICE SUMMARY - #${liveOrder.id}*\n*Customer:* ${liveOrder.customerName}\n*Qty:* ${totalFulfilledQty}\n*Amount:* ₹${totalInvoiceAmount.toFixed(1)}`; navigator.clipboard.writeText(summary); showNotification(`Invoice summary copied`, 'success'); }} className={`flex items-center gap-1.5 px-4 md:px-5 py-2.5 md:py-3.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl font-bold text-[10px] md:text-[11px] uppercase tracking-[0.1em] transition-all active:scale-95 ${totalFulfilledQty === 0 ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}><Send size={16} /> Share</button><button disabled={totalFulfilledQty === 0 || isAddAssignLocked} onClick={() => setIsAssignModalOpen(true)} className={`flex items-center gap-1.5 px-4 md:px-6 py-2.5 md:py-3.5 rounded-xl font-bold text-[10px] md:text-[11px] uppercase tracking-[0.1em] transition-all active:scale-95 shadow-sm border ${(totalFulfilledQty === 0 || isAddAssignLocked) ? 'opacity-50 cursor-not-allowed grayscale' : ''} ${liveOrder.assignedTo ? 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100' : 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'}`}><UserCheck size={16} /> {liveOrder.assignedTo ? liveOrder.assignedTo.toUpperCase() : 'ASSIGN'}</button></>) : (<button onClick={handleStatusProgress} disabled={totalFulfilledQty === 0 || isStatusUpdating} className="flex items-center gap-2 px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95 disabled:bg-slate-100 disabled:text-slate-300">{isStatusUpdating ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} strokeWidth={2.5} />}{currentUser.role === 'Picker' ? 'MARK AS PICKED' : currentUser.role === 'Checker' ? 'MARK AS CHECKED' : 'MARK AS DISPATCHED'}</button>)}</div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col no-print">
        <div className="px-4 md:px-6 py-4 border-b border-slate-100 flex flex-col xl:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full max-w-xl"><input type="text" placeholder="Filter items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-2.5 md:py-3 bg-white border-2 border-[#3b82f6] rounded-xl text-[11px] font-semibold outline-none shadow-sm transition-all focus:ring-4 focus:ring-blue-100" /><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /></div>
          {!isStaff && (<div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto"><div className="flex items-center gap-2 border border-slate-200 rounded-xl px-2 py-1.5 bg-slate-50 transition-colors w-full sm:auto justify-center"><span className="text-slate-400"><RotateCcw size={14} /></span><input type="number" value={bulkLessValue} disabled={isModificationLocked} onChange={(e) => setBulkLessValue(e.target.value)} placeholder="0" className="w-14 h-8 bg-white border border-slate-200 rounded-lg text-center text-[10px] font-bold outline-none disabled:bg-slate-50" /><button onClick={handleApplyBulkLess} disabled={isModificationLocked} className="bg-[#ef4444] text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm hover:brightness-110 active:scale-95 disabled:opacity-50">APPLY</button></div><button onClick={handleFulfillAllClick} disabled={isModificationLocked} className={`w-full sm:w-auto px-6 py-2.5 bg-[#f1f5f9] border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-[0.15em] rounded-xl hover:bg-slate-200 shadow-sm transition-all active:scale-95 ${isModificationLocked ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>FULFILL ALL</button></div>)}
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <th className="px-6 py-5 cursor-pointer select-none group" onClick={() => handleSort('brand')}>Brand <HeaderSortIcon columnKey="brand" /></th>
                <th className="px-6 py-5 cursor-pointer select-none group" onClick={() => handleSort('quality')}>Quality <HeaderSortIcon columnKey="quality" /></th>
                <th className="px-6 py-5 cursor-pointer select-none group" onClick={() => handleSort('category')}>Category <HeaderSortIcon columnKey="category" /></th>
                <th className="px-6 py-5 cursor-pointer select-none group" onClick={() => handleSort('model')}>Model <HeaderSortIcon columnKey="model" /></th>
                {!isStaff && (<><th className="px-6 py-5 text-center cursor-pointer select-none group" onClick={() => handleSort('orderQty')}>Order Qty <HeaderSortIcon columnKey="orderQty" /></th><th className="px-6 py-5 text-center cursor-pointer select-none group" onClick={() => handleSort('displayPrice')}>Display Price <HeaderSortIcon columnKey="displayPrice" /></th></>)}
                <th className="px-6 py-5 text-center cursor-pointer select-none group" onClick={() => handleSort('fulfillQty')}>Fulfill Qty <HeaderSortIcon columnKey="fulfillQty" /></th>
                <th className="px-6 py-5 text-center cursor-pointer select-none group">{!isStaff ? <>Final Price <HeaderSortIcon columnKey="finalPrice" /></> : "Verify"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAndSortedItems.length === 0 ? (<tr><td colSpan={isStaff ? 6 : 8} className="py-20 text-center opacity-30"><Package size={40} className="mx-auto mb-2" /><p className="text-[10px] font-black uppercase tracking-widest">No items found</p></td></tr>) : filteredAndSortedItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5"><span className="text-[11px] font-bold text-[#3b82f6] uppercase tracking-wider">{item.brand}</span></td>
                  <td className="px-6 py-5"><span className="text-[11px] font-bold text-[#10b981] uppercase tracking-wider">{item.quality}</span></td>
                  <td className="px-6 py-5"><span className="text-[11px] font-bold text-[#a855f7] uppercase tracking-wider">{item.category}</span></td>
                  <td className="px-6 py-5"><p className="text-[11px] font-bold text-[#f97316] uppercase tracking-tight leading-tight max-w-[280px]">{item.model}</p></td>
                  {!isStaff && (<><td className="px-6 py-5 text-center whitespace-nowrap font-bold text-slate-800 text-[12px]">{item.orderQty}</td><td className="px-6 py-5 text-center whitespace-nowrap font-bold text-slate-800 text-[12px]">₹{item.displayPrice.toFixed(1)}</td></>)}
                  <td className="px-6 py-5"><div className="flex justify-center"><input type="number" readOnly={isStaff || isModificationLocked} value={item.fulfillQty === 0 ? '' : item.fulfillQty} onChange={(e) => !isStaff && !isModificationLocked && updateItem(item.id, 'fulfillQty', parseInt(e.target.value) || 0)} className={`w-16 h-10 border rounded-lg text-center text-[12px] font-bold outline-none transition-all ${isStaff || isModificationLocked ? 'bg-slate-50 border-transparent text-slate-400' : 'bg-white border-slate-200 text-slate-800 focus:border-[#3b82f6]'}`} /></div></td>
                  <td className="px-6 py-5 text-center"><div className="flex justify-center">{!isStaff ? <StablePriceInput value={item.finalPrice} onSave={(newVal) => updateItem(item.id, 'finalPrice', newVal)} isLocked={isModificationLocked} /> : <button onClick={() => toggleItemCheck(item.id)} className={`p-2 rounded-xl transition-all active:scale-90 ${checkedItems[item.id] ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300'}`}>{checkedItems[item.id] ? <CheckSquare size={20} strokeWidth={3} /> : <Square size={20} strokeWidth={3} />}</button>}</div></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-100 bg-slate-50/30">
              <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <td colSpan={isStaff ? 4 : 4} className="px-6 py-6 text-right">Summary:</td>
                <td className="px-6 py-6 text-center text-slate-400">Total Lines: <span className="text-slate-900 text-[13px]">{items.length}</span></td>
                {!isStaff && <td className="px-6 py-6"></td>}
                <td className="px-6 py-6 text-center">Total Qty: <span className="text-slate-900 text-[14px]">{totalFulfilledQty}</span></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {isInvoiceModalOpen && !isStaff && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-0 md:p-10 animate-in fade-in duration-300">
            <div className="bg-white w-full h-full md:h-auto md:max-h-[95vh] lg:w-[95vw] lg:h-[90vh] rounded-none md:rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
                {/* Header Title */}
                <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-white shrink-0 no-print">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">Invoice Preview - Order : {liveOrder.id}</span>
                    <button onClick={() => setIsInvoiceModalOpen(false)} className="text-slate-400 hover:text-rose-600 transition-colors p-1">
                        <X size={20} />
                    </button>
                </div>

                {/* Main PDF Viewer Shell */}
                <div className="flex-1 flex flex-col bg-[#323639] overflow-hidden print:bg-white">
                    {/* Viewer Toolbar */}
                    <div className="h-12 bg-[#323639] px-4 flex items-center justify-between text-white shrink-0 shadow-md no-print">
                        <div className="flex items-center gap-4">
                            <button className="p-1.5 hover:bg-white/10 rounded transition-colors"><MenuIcon size={18} /></button>
                            <span className="text-xs font-medium opacity-80 max-w-[200px] truncate">Invoice_{liveOrder.id}.pdf</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 px-3 mr-4 border-x border-white/10">
                                <span className="text-[11px] opacity-60">1 / 1</span>
                            </div>
                            <button onClick={handleZoomOut} className="p-1.5 hover:bg-white/10 rounded" title="Zoom Out"><ZoomOut size={16} /></button>
                            <span className="text-xs font-bold px-2 w-12 text-center">{zoomLevel}%</span>
                            <button onClick={handleZoomIn} className="p-1.5 hover:bg-white/10 rounded" title="Zoom In"><ZoomIn size={16} /></button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-white/10 rounded" title="Rotate"><RotateCw size={16} /></button>
                            <button className="p-2 hover:bg-white/10 rounded" title="Full Screen"><Maximize2 size={16} /></button>
                            <div className="w-px h-6 bg-white/10 mx-2"></div>
                            <button onClick={handleDownloadInvoice} className="p-2 hover:bg-white/10 rounded" title="Download"><Download size={18} /></button>
                            <button onClick={handlePrintInvoice} className="p-2 hover:bg-white/10 rounded" title="Print"><Printer size={18} /></button>
                            <button className="p-2 hover:bg-white/10 rounded"><MoreVertical size={18} /></button>
                        </div>
                    </div>

                    {/* Viewer Workspace */}
                    <div className="flex-1 flex bg-[#525659] overflow-hidden print:bg-white">
                        {/* Sidebar Thumbnails */}
                        <div className="w-[180px] hidden md:flex flex-col bg-[#3c4043] border-r border-black/20 p-4 shrink-0 overflow-y-auto custom-scrollbar items-center no-print">
                            <div 
                                onClick={() => setZoomLevel(100)}
                                className="w-full aspect-[1/1.4] bg-white border-2 border-indigo-500 shadow-xl rounded p-2 flex flex-col items-center justify-center mb-2 cursor-pointer hover:brightness-95 transition-all"
                            >
                                <div className="scale-[0.12] origin-top w-[600px] h-[800px] pointer-events-none opacity-60">
                                    <div className="w-full h-full bg-white text-black p-10 flex flex-col items-center justify-center">
                                        <h1 className="text-5xl font-black text-center">{superAdminName}</h1>
                                        <div className="h-4 w-60 bg-black mt-8"></div>
                                        <div className="mt-20 space-y-4 w-full">
                                            <div className="h-8 w-full bg-slate-100"></div>
                                            <div className="h-8 w-full bg-slate-100"></div>
                                            <div className="h-8 w-full bg-slate-100"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <span className="text-[10px] text-white/50 font-bold">1</span>
                        </div>

                        {/* Main Document Canvas */}
                        <div className="flex-1 overflow-auto p-4 md:p-12 flex flex-col items-center custom-scrollbar print:p-0 print:overflow-visible">
                            <div 
                                ref={invoiceDocRef}
                                style={{ 
                                    transform: `scale(${zoomLevel / 100})`, 
                                    transformOrigin: 'top center',
                                    marginBottom: zoomLevel > 100 ? `${(zoomLevel - 100) * 10}px` : '0'
                                }}
                                className="bg-white w-full max-w-[800px] shadow-2xl p-8 md:p-14 font-sans text-slate-900 flex flex-col h-fit transition-transform duration-200 ease-out print:shadow-none print:transform-none print:m-0 print:max-w-full"
                            >
                                <div className="text-center mb-10">
                                    <h1 className="text-3xl font-black tracking-tighter uppercase text-slate-900 leading-none">{superAdminName}</h1>
                                    <div className="h-1 w-24 bg-slate-900 mx-auto mt-3"></div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mt-4">Authorized Distribution Channel</p>
                                </div>

                                <div className="flex flex-col sm:flex-row justify-between items-start mb-12 text-[12px] gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] mb-2">Customer:</p>
                                            <p className="font-black text-xl text-slate-900 uppercase leading-none">{liveOrder.customerName}</p>
                                            {customerPhone && <p className="text-slate-800 font-black mt-1 text-[11px] leading-tight">M: {customerPhone}</p>}
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right space-y-2">
                                        <div className="space-y-1.5">
                                            <p className="font-bold text-slate-600 uppercase text-[11px]">Date : <span className="text-slate-900 font-black ml-2">{liveOrder.orderTime.split(' ')[0]}</span></p>
                                            <p className="font-bold text-slate-600 uppercase text-[11px]">Invoice No : <span className="text-slate-900 font-black ml-2">#{liveOrder.id}</span></p>
                                            <p className="font-bold text-slate-600 uppercase text-[11px]">Mode : <span className="text-slate-900 font-black ml-2">{liveOrder.orderMode}</span></p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="border-y-2 border-slate-900 bg-slate-50">
                                                <th className="py-4 px-1 text-left text-[10px] font-black uppercase tracking-widest text-slate-900">Item Description</th>
                                                <th className="py-4 px-1 text-center text-[10px] font-black uppercase tracking-widest text-slate-900 w-16">Qty</th>
                                                <th className="py-4 px-1 text-center text-[10px] font-black uppercase tracking-widest text-slate-900 w-24">Rate</th>
                                                <th className="py-4 px-1 text-right text-[10px] font-black uppercase tracking-widest text-slate-900 w-32">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {items.filter(i => i.fulfillQty > 0).map((item, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50">
                                                    <td className="py-4 px-2">
                                                        <p className="text-[12px] font-black uppercase text-slate-800 leading-tight">{item.brand} {item.quality} {item.category} {item.model}</p>
                                                    </td>
                                                    <td className="py-4 px-2 text-center text-sm font-black text-slate-900">{item.fulfillQty}</td>
                                                    <td className="py-4 px-2 text-center text-sm font-bold text-slate-700 italic">₹{item.finalPrice.toFixed(1)}</td>
                                                    <td className="py-4 px-2 text-right text-sm font-black text-slate-900 tracking-tight">₹{(item.fulfillQty * item.finalPrice).toFixed(1)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-slate-900 text-white border-t-2 border-slate-900">
                                                <td colSpan={4} className="py-6 px-6">
                                                    <div className="flex justify-between items-center text-sm font-black uppercase tracking-widest">
                                                        <div className="flex items-center gap-4">
                                                            <span className="opacity-60 text-[10px]">Total Qty:</span>
                                                            <span className="text-xl">{totalFulfilledQty} PCS</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <span className="opacity-60 text-[10px]">Grand Total:</span>
                                                            <span className="text-3xl tracking-tighter italic font-black">₹{totalInvoiceAmount.toFixed(1)}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <div className="text-center mt-12 pt-8 border-t border-slate-100">
                                    <h3 className="text-lg font-black tracking-tight text-slate-800 uppercase">Thank You For Ordering</h3>
                                    <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-[0.2em]">Computer Generated Digital Document Node Signature.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Professional Footer Controls */}
                <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end items-center gap-3 shrink-0 no-print">
                    <button 
                        onClick={handleDownloadInvoice}
                        className="px-8 py-3 bg-[#7c3aed] text-white rounded-xl font-black text-[11px] uppercase tracking-[0.15em] shadow-xl shadow-purple-200 hover:bg-[#6d28d9] transition-all active:scale-95 flex items-center gap-2"
                    >
                        <Download size={16} /> Download Invoice
                    </button>
                    <button 
                        onClick={() => setIsInvoiceModalOpen(false)}
                        className="px-8 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl font-black text-[11px] uppercase tracking-[0.15em] hover:bg-slate-50 transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
      )}

      {isRejectConfirmOpen && !isStaff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[340px] overflow-hidden border border-slate-100 animate-in zoom-in-95"><div className="p-6 md:p-8 text-center"><div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={24} /></div><h3 className="text-base font-bold text-slate-900 uppercase tracking-tight mb-2">Confirm REJECT?</h3><p className="text-[11px] font-medium text-slate-400 leading-relaxed uppercase tracking-widest">This will mark the order as REJECT and remove it from the pipeline.</p></div><div className="flex border-t border-slate-50"><button onClick={() => setIsRejectConfirmOpen(false)} className="flex-1 py-3.5 text-[9px] font-bold uppercase text-slate-400 hover:bg-slate-50 transition-colors">Cancel</button><button onClick={handleRejectOrder} className="flex-1 py-3.5 text-[9px] font-bold uppercase bg-rose-600 text-white hover:bg-rose-700 shadow-inner">Yes, REJECT</button></div></div>
        </div>
      )}

      {isFulfillWarningOpen && !isStaff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[260] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[360px] overflow-hidden border border-slate-100 animate-in zoom-in-95"><div className="p-6 md:p-8 text-center"><div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4"><Info size={24} /></div><h3 className="text-base font-bold text-slate-900 uppercase tracking-tight mb-3">Reset Changes?</h3><p className="text-[12px] font-medium text-slate-400 uppercase tracking-tight">Aapne jo change kiya hai vo fir se order qty aur display price ki tarah ho jayega. Kya aap ise karna chahte hain?</p></div><div className="flex border-t border-slate-50"><button onClick={() => setIsFulfillWarningOpen(false)} className="flex-1 py-4 text-[9px] font-bold uppercase text-slate-400 hover:bg-slate-50">Cancel</button><button onClick={executeFulfillAll} className="flex-1 py-4 text-[9px] font-bold uppercase bg-indigo-600 text-white hover:bg-indigo-700 shadow-inner">Yes, RESET</button></div></div>
        </div>
      )}

      {isAddModelsModalOpen && !isStaff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-2 md:p-4 no-print"><div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl h-[90vh] md:h-[80vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95"><div className="px-6 md:px-8 py-4 md:py-6 border-b border-slate-50 flex justify-between items-center bg-blue-50/30"><div className="flex items-center gap-3"><div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center"><PlusCircle size={18} /></div><h3 className="text-sm md:text-base font-bold text-slate-800 uppercase">Add Models</h3></div><button onClick={() => setIsAddModelsModalOpen(false)} className="text-slate-300 hover:text-slate-600"><X size={22} /></button></div><div className="p-4 md:p-6 shrink-0"><div className="relative"><input type="text" placeholder="Search..." value={addModelsSearch} onChange={(e) => setAddModelsSearch(e.target.value)} className="w-full pl-11 pr-4 py-2.5 md:py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] md:text-[12px] font-bold uppercase outline-none focus:bg-white focus:border-blue-400" /><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /></div></div><div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-4 bg-slate-50/30">{loadingInventory ? (<Loader2 className="animate-spin mx-auto text-blue-500" size={32} />) : inventory.filter(i => i.status !== 'Inactive' && (i.model.toLowerCase().includes(addModelsSearch.toLowerCase()) || i.brand.toLowerCase().includes(addModelsSearch.toLowerCase()))).map(item => (<div key={item.id} className="bg-white p-4 md:p-5 rounded-[1.5rem] border border-slate-100 flex items-center justify-between group"><div className="flex-1 min-w-0 pr-2"><h4 className="text-[12px] md:text-[13px] font-bold text-slate-800 uppercase truncate leading-tight">{item.model}</h4><p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{item.brand} | ₹{item.price.toFixed(1)}</p></div><button onClick={() => handleAddItemToOrder(item)} className="px-4 md:px-6 py-2 md:py-2.5 bg-blue-600 text-white rounded-xl text-[9px] md:text-[10px] font-bold uppercase tracking-widest shadow-lg active:scale-95 shrink-0">Add</button></div>))}</div><div className="px-6 md:px-8 py-4 md:py-6 bg-slate-50 border-t border-slate-100 flex justify-end"><button onClick={() => setIsAddModelsModalOpen(false)} className="px-6 md:px-8 py-2.5 md:py-3 bg-white border border-slate-200 rounded-xl text-slate-400 font-bold uppercase text-slate-500">Close</button></div></div></div>
      )}

      {isAssignModalOpen && !isStaff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print"><div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95"><div className="px-6 md:px-8 py-4 md:py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"><h3 className="text-sm md:text-base font-black text-slate-800 uppercase">Select Personnel</h3><button onClick={() => setIsAssignModalOpen(false)} className="text-slate-300 hover:text-slate-600 transition-all hover:rotate-90"><X size={22} /></button></div><div className="p-4 md:p-8 space-y-3 min-h-[200px] flex flex-col">{allUsers.filter(u => u.role === 'Picker' && u.active).length === 0 ? (<div className="flex-1 flex flex-col items-center justify-center text-center p-6 opacity-40 grayscale"><Users size={48} className="mb-4" /><p className="text-[11px] font-black uppercase tracking-[0.2em]">No active pickers detected</p></div>) : (allUsers.filter(u => u.role === 'Picker' && u.active).map(picker => (<button key={picker.id} onClick={() => handleAssignPicker(picker)} className="w-full flex items-center justify-between px-6 py-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-500 transition-all group"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center font-black text-xs group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">{picker.name.charAt(0)}</div><span className="text-[12px] md:sm font-black text-slate-800 uppercase">{picker.name}</span></div><ChevronRight size={18} className="text-slate-200 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" /></button>)))}</div><div className="px-6 md:px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-center"><button onClick={() => setIsAssignModalOpen(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-slate-600">Cancel Protocol</button></div></div></div>
      )}
    </div>
  );
};

export default OrderDetail;