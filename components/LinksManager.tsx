import React, { useState, useMemo, useEffect } from 'react';
import { 
    Search, Copy, X, Plus, Check, RefreshCw, Trash2, Send, ShoppingBag, 
    Layers, Smartphone, ArrowRight, LogOut, Loader2, QrCode, Globe, Link2, 
    Settings2, Radio, CopyPlus, Users, User, CheckSquare, Square,
    Package, ChevronRight, Lock, ChevronUp, ChevronDown, ShoppingCart, AlertCircle,
    CreditCard, ReceiptText, History, RotateCcw, CheckCircle2, Building2,
    Download, Share2, ChevronLeft, ChevronRight as ChevronRightIcon, Target, MessageSquare, UserCheck, CheckCircle,
    ArrowLeftRight, Filter, MinusCircle, PlusCircle, LayoutGrid, ArrowLeft,
    Home, Database, Zap, AlertTriangle, Ban, Truck, UserCircle, MapPin, Printer, Phone, FileText, Info,
    Activity, Pencil
} from 'lucide-react';
import { InventoryItem, Customer, Order, OrderItem, Firm, User as UserType } from '../types';
import { MOCK_INVENTORY } from '../constants';
import { fetchLinks, addLinkToDB, updateLinkInDB, deleteLinkFromDB, fetchInventory, fetchGroups, fetchCustomers, fetchOrders, addOrderToDB, fetchFirms, fetchMasterRecords } from '../services/db';
import { useNotification } from '../context/NotificationContext';
import CustomerPortal from './CustomerPortal';

const PAGE_SIZE_OPTIONS = [100, 200, 300, 500, 1000];

interface LinkEntry {
    id: string; 
    title: string; 
    code: string; 
    status: 'Enabled' | 'Disabled'; 
    createdDate: string; 
    warehouse: string;
    allowedModels?: string[];
    instanceId?: string;
}

interface LinksManagerProps {
    currentUser: UserType;
}

const LinksManager: React.FC<LinksManagerProps> = ({ currentUser }) => {
  const [links, setLinks] = useState<LinkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [broadcastGroups, setBroadcastGroups] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [availableWarehouses, setAvailableWarehouses] = useState<string[]>([]);
  const { showNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isManageModelsOpen, setIsManageModelsOpen] = useState(false);
  const [visibilityPane, setVisibilityPane] = useState<'master' | 'link'>('master');
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  
  const [activeLink, setActiveLink] = useState<LinkEntry | null>(null);
  const [newLinkData, setNewLinkData] = useState({ title: '', warehouse: 'Main Warehouse' });
  const [isSaving, setIsSaving] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  
  const [vSearch, setVSearch] = useState('');
  const [vCurrentPage, setVCurrentPage] = useState(1);
  const [vItemsPerPage, setVItemsPerPage] = useState(100);
  const [selectedMasterIds, setSelectedMasterIds] = useState<string[]>([]);
  const [selectedPortalIds, setSelectedPortalIds] = useState<string[]>([]);

  const [broadcastType, setBroadcastType] = useState<'groups' | 'customers'>('groups');
  const [selectedBroadcastIds, setSelectedBroadcastIds] = useState<string[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');

  const filteredLinks = useMemo(() => {
    return links.filter(l => 
        (l.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (l.code || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [links, searchTerm]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
      setLoading(true);
      try {
          const [dbLinks, dbInv, dbGroups, dbCustomers, dbWarehouses] = await Promise.all([
              fetchLinks(), 
              fetchInventory(), 
              fetchGroups(),
              fetchCustomers(),
              fetchMasterRecords('warehouse')
          ]);
          setLinks(dbLinks || []);
          setInventory(dbInv?.length > 0 ? dbInv : MOCK_INVENTORY);
          setBroadcastGroups(dbGroups || []);
          setCustomers(dbCustomers || []);
          
          // Ensure "Main Warehouse" is at least present as a default if none exist
          const warehouseList = dbWarehouses.length > 0 ? dbWarehouses : ['Main Warehouse'];
          setAvailableWarehouses(warehouseList);
          
          // Update default warehouse for new links if currently empty or set to mock
          if (!newLinkData.warehouse || newLinkData.warehouse.includes('APEXFLOW')) {
              setNewLinkData(prev => ({ ...prev, warehouse: warehouseList[0] }));
          }
      } finally {
          setLoading(false);
      }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    showNotification('Portal environment synchronized');
  };

  const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkData.title.trim()) return;
    setIsSaving(true);
    const newLink: LinkEntry = {
        id: `link-${Date.now()}`,
        title: newLinkData.title.toUpperCase(),
        code: generateCode(),
        status: 'Enabled',
        createdDate: new Date().toLocaleDateString('en-GB'),
        warehouse: newLinkData.warehouse,
        allowedModels: [],
        instanceId: currentUser.instanceId
    };
    await addLinkToDB(newLink);
    setLinks([newLink, ...links]);
    setIsSaving(false);
    setIsCreateModalOpen(false);
    setNewLinkData({ title: '', warehouse: availableWarehouses[0] || 'Main Warehouse' });
    showNotification('Portal generated');
  };

  const handleUpdateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLink || !newLinkData.title.trim()) return;
    setIsSaving(true);
    const updated: LinkEntry = { ...activeLink, title: newLinkData.title.toUpperCase(), warehouse: newLinkData.warehouse };
    try {
        await updateLinkInDB(updated);
        setLinks(links.map(l => l.id === activeLink.id ? updated : l));
        setIsEditModalOpen(false);
        showNotification('Portal updated successfully');
    } catch (err) {
        showNotification('Update failed', 'error');
    } finally {
        setIsSaving(false);
    }
  };

  const handleDuplicate = (link: LinkEntry) => {
    const duplicated: LinkEntry = { 
        ...link, 
        id: `link-${Date.now()}`, 
        title: `${link.title} (COPY)`, 
        code: generateCode(), 
        createdDate: new Date().toLocaleDateString('en-GB') 
    };
    setLinks([duplicated, ...links]);
    addLinkToDB(duplicated);
    showNotification('Portal link duplicated');
  };

  const handleCopy = (link: LinkEntry) => {
    const url = `${window.location.origin}${window.location.pathname}?portal=${link.code}`;
    navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
    showNotification('Portal URL copied');
  };

  const handleToggleStatus = async (link: LinkEntry) => {
    const newStatus = link.status === 'Enabled' ? 'Disabled' : 'Enabled';
    const updated = { ...link, status: newStatus as any };
    setLinks(links.map(l => l.id === link.id ? updated : l));
    await updateLinkInDB(updated);
    showNotification(`Access ${newStatus.toLowerCase()}`);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Permanently revoke this portal?")) return;
    setLinks(links.filter(l => l.id !== id));
    await deleteLinkFromDB(id);
    showNotification('Access revoked', 'error');
  };

  const handleAddToLink = async () => {
    if (!activeLink || selectedMasterIds.length === 0) return;
    const currentAllowed = activeLink.allowedModels || [];
    const newAllowed = Array.from(new Set([...currentAllowed, ...selectedMasterIds]));
    const updated = { ...activeLink, allowedModels: newAllowed };
    setActiveLink(updated);
    setLinks(links.map(l => l.id === activeLink.id ? updated : l));
    setSelectedMasterIds([]);
    await updateLinkInDB(updated);
    showNotification(`${selectedMasterIds.length} items added`);
  };

  const handleRemoveFromLink = async () => {
    if (!activeLink || selectedPortalIds.length === 0) return;
    const currentAllowed = activeLink.allowedModels || [];
    const newAllowed = currentAllowed.filter(id => !selectedPortalIds.includes(id));
    const updated = { ...activeLink, allowedModels: newAllowed };
    setActiveLink(updated);
    setLinks(links.map(l => l.id === activeLink.id ? updated : l));
    setSelectedPortalIds([]);
    await updateLinkInDB(updated);
    showNotification(`${selectedPortalIds.length} items removed`);
  };

  const fullMasterList = useMemo(() => {
    const allowedIds = activeLink?.allowedModels || [];
    return inventory.filter(i => 
        i.status !== 'Inactive' && 
        !allowedIds.includes(i.id) &&
        ((i.model || '').toLowerCase().includes(vSearch.toLowerCase()) || 
         (i.brand || '').toLowerCase().includes(vSearch.toLowerCase()) ||
         (i.category || '').toLowerCase().includes(vSearch.toLowerCase()))
    );
  }, [inventory, activeLink, vSearch]);

  const fullPortalList = useMemo(() => {
    const allowedIds = activeLink?.allowedModels || [];
    return inventory.filter(i => 
        i.status !== 'Inactive' && 
        allowedIds.includes(i.id) &&
        ((i.model || '').toLowerCase().includes(vSearch.toLowerCase()) || 
         (i.brand || '').toLowerCase().includes(vSearch.toLowerCase()) ||
         (i.category || '').toLowerCase().includes(vSearch.toLowerCase()))
    );
  }, [inventory, activeLink, vSearch]);

  const currentViewList = visibilityPane === 'master' ? fullMasterList : fullPortalList;
  const totalVItems = currentViewList.length;
  const totalVPages = Math.ceil(totalVItems / vItemsPerPage);
  const paginatedVItems = useMemo(() => {
    const start = (vCurrentPage - 1) * vItemsPerPage;
    return currentViewList.slice(start, start + vItemsPerPage);
  }, [currentViewList, vCurrentPage, vItemsPerPage]);

  // Bulk Select Logic
  const isAllViewSelected = useMemo(() => {
      const selectedList = visibilityPane === 'master' ? selectedMasterIds : selectedPortalIds;
      return paginatedVItems.length > 0 && paginatedVItems.every(i => selectedList.includes(i.id));
  }, [paginatedVItems, selectedMasterIds, selectedPortalIds, visibilityPane]);

  const handleToggleSelectAll = () => {
      const currentIds = paginatedVItems.map(i => i.id);
      if (visibilityPane === 'master') {
          if (isAllViewSelected) {
              setSelectedMasterIds(prev => prev.filter(id => !currentIds.includes(id)));
          } else {
              setSelectedMasterIds(prev => Array.from(new Set([...prev, ...currentIds])));
          }
      } else {
          if (isAllViewSelected) {
              setSelectedPortalIds(prev => prev.filter(id => !currentIds.includes(id)));
          } else {
              setSelectedPortalIds(prev => Array.from(new Set([...prev, ...currentIds])));
          }
      }
  };

  const handleSendBroadcast = () => {
      if (selectedBroadcastIds.length === 0) { showNotification('Please select recipients', 'error'); return; }
      showNotification(`Broadcast initiated for ${selectedBroadcastIds.length} recipients`, 'success');
      setIsBroadcastOpen(false);
      setSelectedBroadcastIds([]);
  };

  const handleOpenBroadcast = (link: LinkEntry) => {
    setActiveLink(link);
    setBroadcastMessage(`Check our new portal: ${window.location.origin}${window.location.pathname}?portal=${link.code}`);
    setIsBroadcastOpen(true);
  };

  const filteredRecipients = useMemo(() => {
      if (broadcastType === 'groups') return (broadcastGroups || []).filter(g => (g.name || '').toLowerCase().includes(recipientSearch.toLowerCase()));
      return (customers || []).filter(c => (c.name || '').toLowerCase().includes(recipientSearch.toLowerCase()) || (c.phone || '').includes(recipientSearch));
  }, [broadcastType, broadcastGroups, customers, recipientSearch]);

  if (simulationMode && activeLink) {
      const allowedInventory = inventory.filter(i => i.status !== 'Inactive' && (activeLink.allowedModels || []).includes(i.id));
      return <CustomerPortal storeName={activeLink.title} status={activeLink.status} onClose={() => setSimulationMode(false)} inventory={allowedInventory} allCustomers={customers} instanceId={activeLink.instanceId} />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col xl:flex-row justify-between items-center gap-6 no-print">
        <div className="flex items-center gap-5 w-full xl:w-auto">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100 shrink-0"><Link2 size={28} strokeWidth={2.5} /></div>
            <div><h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Portals</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Direct Access Nodes</p></div>
        </div>
        <div className="flex items-center gap-3 w-full xl:w-auto">
            <div className="relative flex-1 group min-w-[300px]"><Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" /><input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by portal name..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[2.5rem] text-[13px] font-bold uppercase outline-none focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-sm" /></div>
            <button onClick={handleRefresh} className="p-4 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-indigo-600 shadow-sm transition-all active:rotate-180 duration-700"><RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} /></button>
            <button onClick={() => { setNewLinkData({title: '', warehouse: availableWarehouses[0] || 'Main Warehouse'}); setIsCreateModalOpen(true); }} className="px-10 py-4 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-lg flex items-center gap-2 whitespace-nowrap"><Plus size={16} strokeWidth={4} /> Create Portal</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8">
        {loading ? Array(3).fill(0).map((_, i) => (<div key={i} className="h-[380px] bg-white rounded-[2.5rem] border border-slate-200 animate-pulse"></div>)) : filteredLinks.map(link => (
            <div key={link.id} className={`bg-white group rounded-[2.5rem] border border-slate-200 p-8 shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col h-full ${link.status === 'Disabled' ? 'grayscale-[0.5] opacity-70' : ''}`}>
                <div className="flex justify-between items-start mb-8">
                    <div><div className="flex items-center gap-3 mb-3"><div className={`w-2.5 h-2.5 rounded-full ${link.status === 'Enabled' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div><span className={`text-[10px] font-bold uppercase tracking-widest ${link.status === 'Enabled' ? 'text-emerald-600' : 'text-rose-500'}`}>{link.status}</span></div><div className="flex items-center gap-3"><h3 className={`text-xl font-black uppercase tracking-tighter ${link.status === 'Enabled' ? 'text-slate-900' : 'text-slate-400'}`}>{link.title}</h3><button onClick={() => { setActiveLink(link); setNewLinkData({title: link.title, warehouse: link.warehouse}); setIsEditModalOpen(true); }} className="p-1.5 rounded-lg bg-slate-50 text-slate-300 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100"><Pencil size={14}/></button></div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Center: {link.warehouse}</p></div>
                    <div className="flex items-center gap-2"><button onClick={() => handleToggleStatus(link)} className="p-2.5 bg-white text-slate-400 border border-slate-100 rounded-xl hover:text-rose-500">{link.status === 'Enabled' ? <Ban size={18}/> : <CheckCircle size={18}/>}</button><button onClick={() => handleDelete(link.id)} className="p-2.5 text-slate-300 hover:text-rose-500 rounded-xl"><Trash2 size={18}/></button></div>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-2 rounded-2xl flex items-center gap-3 mb-8"><div className="flex-1 min-w-0 pl-4"><p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Code</p><p className="text-sm font-black text-slate-900 tracking-[0.1em] truncate">{link.code}</p></div><button onClick={() => handleCopy(link)} className={`px-4 py-3 rounded-xl transition-all active:scale-90 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 ${copiedId === link.id ? 'bg-emerald-50 text-white' : 'bg-white text-indigo-600 shadow-sm border border-slate-100'}`}>{copiedId === link.id ? <Check size={14}/> : <Copy size={14}/>}{copiedId === link.id ? 'Copied' : 'Copy'}</button></div>
                <div className="flex items-center gap-4 mb-8 text-[11px] font-black text-slate-500 uppercase tracking-widest mt-auto"><div className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg"><Package size={14}/><span>{(link.allowedModels || []).length} Items</span></div><span className="text-[10px] text-slate-300">{link.createdDate}</span></div>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => { setActiveLink(link); setVisibilityPane('master'); setVSearch(''); setSelectedMasterIds([]); setSelectedPortalIds([]); setIsManageModelsOpen(true); }} className="flex items-center justify-center gap-2 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-indigo-500 transition-all"><Settings2 size={16}/> Visibility</button>
                        <button onClick={() => { setActiveLink(link); setSimulationMode(true); }} className="flex items-center justify-center gap-2 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-100 transition-all"><Smartphone size={16}/> Simulate</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => handleOpenBroadcast(link)} className="flex items-center justify-center gap-2 py-3.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all"><Radio size={16}/> Broadcast</button>
                        <button onClick={() => handleDuplicate(link)} className="flex items-center justify-center gap-2 py-3.5 bg-slate-50 text-slate-500 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"><CopyPlus size={16}/> Duplicate</button>
                    </div>
                </div>
            </div>
        ))}
      </div>

      {isManageModelsOpen && activeLink && (
        <div className="fixed inset-0 bg-[#f8fafc] z-[160] flex flex-col animate-in slide-in-from-bottom-5 duration-300">
            <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shrink-0 shadow-sm">
                <div className="flex items-center gap-5">
                    <button onClick={() => setIsManageModelsOpen(false)} className="p-3 bg-slate-50 border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl shadow-sm"><ArrowLeft size={20}/></button>
                    <div><h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Visibility Logic Console</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1.5 italic">Managing Portal: <span className="text-indigo-600">{activeLink.title}</span></p></div>
                </div>
                <button onClick={() => setIsManageModelsOpen(false)} className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-hidden p-6 bg-slate-50 flex flex-col gap-6">
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
                    <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-slate-100 shrink-0">
                        <div className="flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 min-w-[300px]"><button onClick={() => { setVisibilityPane('master'); setVSearch(''); setVCurrentPage(1); }} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${visibilityPane === 'master' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Global Catalog</button><button onClick={() => { setVisibilityPane('link'); setVSearch(''); setVCurrentPage(1); }} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${visibilityPane === 'link' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Store Distribution</button></div>
                        <div className="flex items-center gap-3">
                            <div className="relative w-64 group"><input type="text" value={vSearch} onChange={(e) => { setVSearch(e.target.value); setVCurrentPage(1); }} placeholder="Find models..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold uppercase outline-none focus:bg-white focus:border-indigo-500 transition-all"/><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" /></div>
                            <button disabled={visibilityPane === 'master' ? selectedMasterIds.length === 0 : selectedPortalIds.length === 0} onClick={visibilityPane === 'master' ? handleAddToLink : handleRemoveFromLink} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ (visibilityPane === 'master' ? selectedMasterIds.length > 0 : selectedPortalIds.length > 0) ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-300 border border-slate-200' }`}>{visibilityPane === 'master' ? 'Add Selected' : 'Remove Selected'}</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <VisibilityTableReplica items={paginatedVItems} selectedIds={visibilityPane === 'master' ? selectedMasterIds : selectedPortalIds} isAllSelected={isAllViewSelected} onToggleAll={handleToggleSelectAll} onSelect={id => { if (visibilityPane === 'master') setSelectedMasterIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); else setSelectedPortalIds(prev => prev.includes(id) ? prev.filter(id => id !== id) : [...prev, id]); }} />
                    </div>
                    <div className="px-8 py-5 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-8"><div className="flex items-center gap-3"><span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Rows</span><select value={vItemsPerPage} onChange={(e) => { setVItemsPerPage(Number(e.target.value)); setVCurrentPage(1); }} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-1.5 text-[11px] font-black outline-none">{PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}</select></div><div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Showing <span className="text-slate-900">{totalVItems ? (vCurrentPage - 1) * vItemsPerPage + 1 : 0}-{Math.min(totalVItems, vCurrentPage * vItemsPerPage)}</span> of <span className="text-slate-900">{totalVItems}</span></div></div>
                        <div className="flex items-center gap-2"><button disabled={vCurrentPage === 1} onClick={() => setVCurrentPage(p => Math.max(1, p - 1))} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-all"><ChevronLeft size={18}/></button><div className="flex items-center gap-1">{Array.from({ length: Math.min(5, totalVPages) }, (_, i) => (<button key={i} onClick={() => setVCurrentPage(i+1)} className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${vCurrentPage === i+1 ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500'}`}>{i+1}</button>))}</div><button disabled={vCurrentPage === totalVPages || totalVPages === 0} onClick={() => setVCurrentPage(p => Math.min(totalVPages, p + 1))} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-all"><ChevronRightIcon size={18}/></button></div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && activeLink && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95">
                  <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg"><Pencil size={20} strokeWidth={3} /></div><div><h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Edit Portal</h3><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Refining Identity</p></div></div>
                      <button onClick={() => setIsEditModalOpen(false)} className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:text-rose-500 transition-all shadow-sm"><X size={20} /></button>
                  </div>
                  <form onSubmit={handleUpdateLink} className="p-8 space-y-6">
                      <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2">Internal Label</label><input required type="text" autoFocus value={newLinkData.title} onChange={e => setNewLinkData({...newLinkData, title: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold uppercase outline-none focus:bg-white focus:border-indigo-500 shadow-inner"/></div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2">Dispatch Center</label>
                          <select value={newLinkData.warehouse} onChange={e => setNewLinkData({...newLinkData, warehouse: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold uppercase outline-none focus:bg-white transition-all">
                              {availableWarehouses.map(w => (
                                  <option key={w} value={w}>{w}</option>
                              ))}
                          </select>
                      </div>
                      <div className="pt-4 flex gap-3"><button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3.5 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest">Discard</button><button disabled={isSaving || !newLinkData.title} className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl">{isSaving ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Save Changes'}</button></div>
                  </form>
              </div>
          </div>
      )}

      {isCreateModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95">
                  <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg"><Plus size={20} strokeWidth={3} /></div><div><h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Generate Portal</h3><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Access Logic Setup</p></div></div>
                      <button onClick={() => setIsCreateModalOpen(false)} className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:text-rose-500 transition-all shadow-sm"><X size={20} /></button>
                  </div>
                  <form onSubmit={handleCreateLink} className="p-8 space-y-6">
                      <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2">Internal Label</label><input required type="text" autoFocus value={newLinkData.title} onChange={e => setNewLinkData({...newLinkData, title: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold uppercase outline-none focus:bg-white focus:border-indigo-500 shadow-inner"/></div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2">Dispatch Center</label>
                          <select value={newLinkData.warehouse} onChange={e => setNewLinkData({...newLinkData, warehouse: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold uppercase outline-none focus:bg-white transition-all">
                              {availableWarehouses.map(w => (
                                  <option key={w} value={w}>{w}</option>
                              ))}
                          </select>
                      </div>
                      <div className="pt-4 flex gap-3"><button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-3.5 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest">Discard</button><button disabled={isSaving || !newLinkData.title} className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl">{isSaving ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Create'}</button></div>
                  </form>
              </div>
          </div>
      )}

      {/* BROADCAST MODAL */}
      {isBroadcastOpen && activeLink && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><Radio size={28} /></div>
                        <div><h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">Share Portal</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2 italic">Broadcasting Link for <span className="text-indigo-600">{activeLink.title}</span></p></div>
                    </div>
                    <button onClick={() => setIsBroadcastOpen(false)} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all hover:rotate-90 shadow-sm"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-slate-50/30 custom-scrollbar">
                    <div className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Auto-Generated Message</label>
                        <textarea value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[13px] font-bold text-slate-600 outline-none focus:border-emerald-500 transition-all min-h-[100px] resize-none shadow-sm" />
                    </div>
                    <div className="space-y-4">
                        <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200"><button onClick={() => { setBroadcastType('groups'); setSelectedBroadcastIds([]); }} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${broadcastType === 'groups' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}`}>Target Groups</button><button onClick={() => { setBroadcastType('customers'); setSelectedBroadcastIds([]); }} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${broadcastType === 'customers' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}`}>Direct Customers</button></div>
                        <div className="relative group"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" value={recipientSearch} onChange={e => setRecipientSearch(e.target.value)} placeholder={`Search ${broadcastType}...`} className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-sm" /></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {filteredRecipients.map(item => (
                                <button key={item.id} onClick={() => setSelectedBroadcastIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])} className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between group ${selectedBroadcastIds.includes(item.id) ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-slate-100 hover:border-emerald-100'}`}><div className="min-w-0 pr-2"><p className={`text-[12px] font-black uppercase tracking-tight truncate leading-none ${selectedBroadcastIds.includes(item.id) ? 'text-emerald-600' : 'text-slate-800'}`}>{item.name}</p><p className="text-[9px] font-bold text-slate-400 uppercase mt-1.5">{broadcastType === 'groups' ? `${(item.members || []).length} Members` : item.phone}</p></div><div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedBroadcastIds.includes(item.id) ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200'}`}>{selectedBroadcastIds.includes(item.id) && <Check size={12} strokeWidth={4}/>}</div></button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="px-10 py-6 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{selectedBroadcastIds.length} Recipients Selected</span>
                    <button onClick={handleSendBroadcast} disabled={selectedBroadcastIds.length === 0} className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"><Send size={16}/> Start Broadcast</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const VisibilityTableReplica: React.FC<{ items: InventoryItem[], selectedIds: string[], isAllSelected: boolean, onToggleAll: () => void, onSelect: (id: string) => void }> = ({ items, selectedIds, isAllSelected, onToggleAll, onSelect }) => (
    <div className="bg-white">
        <table className="w-full text-left table-fixed min-w-[1200px]">
            <thead className="sticky top-0 z-20">
                <tr className="bg-slate-100/80 backdrop-blur-md border-b border-slate-200">
                    <th className="w-[45px] px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
                        <button onClick={onToggleAll} className="flex justify-center w-full focus:outline-none" title="Select All in Current View">
                            <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${isAllSelected ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'bg-white border-slate-300 hover:border-indigo-400'}`}>
                                {isAllSelected && <Check size={12} strokeWidth={4} className="text-white" />}
                            </div>
                        </button>
                    </th>
                    <th className="w-[120px] px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Brand</th>
                    <th className="w-[120px] px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Quality</th>
                    <th className="w-[140px] px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                    <th className="flex-1 px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Model Specification</th>
                    <th className="w-[120px] px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Price (₹)</th>
                    <th className="w-[140px] px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">In-Hand Stock</th>
                    <th className="w-[140px] px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                    <th className="w-[100px] px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">System ID</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {items.length === 0 ? (<tr><td colSpan={9} className="py-24 text-center text-slate-300 font-black text-[10px] uppercase tracking-widest">No entries available</td></tr>) : items.map(item => (
                    <tr key={item.id} onClick={() => onSelect(item.id)} className={`cursor-pointer transition-all duration-100 group ${selectedIds.includes(item.id) ? 'bg-indigo-50/40' : 'hover:bg-slate-50/60'}`}>
                        <td className="px-4 py-2 text-center"><div className="flex justify-center"><div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${selectedIds.includes(item.id) ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'bg-white border-slate-200 group-hover:border-indigo-400'}`}>{selectedIds.includes(item.id) && <Check size={12} strokeWidth={4} className="text-white" />}</div></div></td>
                        <td className="px-4 py-2"><span className="text-[10px] font-black text-indigo-500 uppercase truncate">{item.brand}</span></td>
                        <td className="px-4 py-2"><span className="text-[10px] font-black text-emerald-600 uppercase truncate">{item.quality}</span></td>
                        <td className="px-4 py-2"><span className="text-[10px] font-bold text-slate-400 uppercase truncate">{item.category || 'GENERAL'}</span></td>
                        <td className="px-4 py-2"><span className="text-[11px] font-black text-slate-800 uppercase truncate leading-none">{item.model}</span></td>
                        <td className="px-4 py-2 text-right"><span className="text-[11px] font-black text-slate-700 font-mono">₹{(item.price || 0).toFixed(1)}</span></td>
                        <td className="px-4 py-2 text-center"><span className={`text-[12px] font-black tracking-tighter ${ (item.quantity || 0) <= 0 ? 'text-rose-500' : (item.quantity || 0) < 10 ? 'text-amber-500' : 'text-emerald-600' }`}>{item.quantity || 0} PCS</span></td>
                        <td className="px-4 py-2 text-center">{(item.quantity || 0) <= 0 ? (<span className="inline-flex px-2 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded text-[8px] font-black uppercase tracking-tighter">OUT OF STOCK</span>) : (<span className="inline-flex px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[8px] font-black uppercase tracking-tighter">LIVE READY</span>)}</td>
                        <td className="px-4 py-2 text-right"><span className="text-[8px] font-mono font-black text-slate-200 uppercase">{(item.id || '').toString().slice(-6)}</span></td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export default LinksManager;