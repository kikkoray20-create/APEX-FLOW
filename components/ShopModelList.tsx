
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Search, RefreshCw, Plus, Edit2, Loader2, FileSpreadsheet, ChevronDown, 
    Filter, X, Package, Tag, PlusCircle, MinusCircle, ClipboardList, 
    ChevronLeft, ChevronRight, MoreHorizontal, LayoutGrid, List, Settings2, 
    Trash2, Box, Layers, ArrowUpDown, CheckCircle, AlertCircle, Info, Database,
    SearchCode, Check
} from 'lucide-react';
import { InventoryItem, InventoryLog } from '../types';
import { fetchInventory, updateInventoryItemInDB, addInventoryItemToDB, addInventoryLogToDB, fetchMasterRecords, addMasterRecord, deleteMasterRecord, fetchLinks, updateLinkInDB } from '../services/db';
import { useNotification } from '../context/NotificationContext';

const PAGE_SIZE_OPTIONS = [50, 100, 200, 300, 500, 1000];

interface ShopItem extends InventoryItem {
    category: string;
    warehouse: string;
    status: string;
    isNew?: string;
}

type SortConfig = {
    key: 'price' | 'quantity' | null;
    direction: 'asc' | 'desc' | null;
};

interface ShopModelListProps {
    onViewModel: (item: ShopItem) => void;
}

const ShopModelList: React.FC<ShopModelListProps> = ({ onViewModel }) => {
    const [items, setItems] = useState<ShopItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { showNotification } = useNotification();

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Master Records States
    const [masters, setMasters] = useState<{ brands: string[], qualities: string[], categories: string[], models: string[], warehouses: string[] }>({
        brands: [], qualities: [], categories: [], models: [], warehouses: []
    });
    const [masterModal, setMasterModal] = useState<{ isOpen: boolean, type: 'brand' | 'quality' | 'category' | 'model' | 'warehouse' | null }>({ isOpen: false, type: null });
    const [masterInput, setMasterInput] = useState('');
    const [isMasterSaving, setIsMasterSaving] = useState(false);

    // Search & Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [warehouseFilter, setWarehouseFilter] = useState('All Warehouse');
    const [statusFilter, setStatusFilter] = useState('Active');

    // Sorting
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Stock Adjustment Modal State
    const [isStockModalOpen, setIsStockModalOpen] = useState(false);
    const [selectedStockItem, setSelectedStockItem] = useState<ShopItem | null>(null);
    const [adjType, setAdjType] = useState<'Add' | 'Remove'>('Add');
    const [adjQty, setAdjQty] = useState('');
    const [adjRemarks, setAdjRemarks] = useState('');
    const [isUpdatingStock, setIsUpdatingStock] = useState(false);

    // Create Form State
    const [createFormData, setCreateFormData] = useState<Partial<ShopItem>>({
        brand: '',
        model: '',
        quality: '',
        category: '',
        warehouse: '',
        price: 0,
        quantity: 0,
        status: 'Active',
        isNew: 'No',
        location: '-'
    });

    useEffect(() => { loadAllData(); }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [invData, b, q, c, m, w] = await Promise.all([
                fetchInventory(),
                fetchMasterRecords('brand'),
                fetchMasterRecords('quality'),
                fetchMasterRecords('category'),
                fetchMasterRecords('model'),
                fetchMasterRecords('warehouse')
            ]);

            setItems((invData || []).map((item: any) => ({ 
                ...item, 
                category: item.category || 'APEXFLOW', 
                warehouse: item.warehouse || 'APEXFLOW', 
                status: item.status || 'Active' 
            })));

            setMasters({ 
                brands: b || [], 
                qualities: q || [], 
                categories: c || [], 
                models: m || [],
                warehouses: w || []
            });
        } catch (error) {
            console.error("Failed to load inventory data", error);
            showNotification('Error syncing data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadAllData();
        setIsRefreshing(false);
        showNotification('Inventory database synchronized');
    };

    const openStockAdjustment = (item: ShopItem) => {
        setSelectedStockItem(item);
        setAdjType('Add');
        setAdjQty('');
        setAdjRemarks('');
        setIsStockModalOpen(true);
    };

    const handleStockAdjustmentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStockItem || !adjQty || isNaN(parseInt(adjQty))) return;

        setIsUpdatingStock(true);
        const change = parseInt(adjQty);
        let newQuantity = selectedStockItem.quantity;
        if (adjType === 'Add') newQuantity += change;
        else newQuantity = newQuantity - change; 

        const updatedItem = { ...selectedStockItem, quantity: newQuantity };
        setItems(prev => prev.map(i => i.id === selectedStockItem.id ? updatedItem : i));

        try {
            await updateInventoryItemInDB(updatedItem);

            if (newQuantity <= 0) {
                const allLinks = await fetchLinks();
                const updatePromises = allLinks.map(link => {
                    const currentAllowed = link.allowedModels || [];
                    const nextAllowed = currentAllowed.filter(id => id !== selectedStockItem.id);
                    if (nextAllowed.length !== currentAllowed.length) {
                        return updateLinkInDB({ ...link, allowedModels: nextAllowed });
                    }
                    return null;
                }).filter(p => p !== null);

                if (updatePromises.length > 0) {
                    await Promise.all(updatePromises);
                    showNotification('System: Item auto-removed from portals due to zero stock', 'info');
                }
            }

            const now = new Date();
            const timestamp = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

            const log: InventoryLog = {
                id: `log-${Date.now()}`,
                itemId: selectedStockItem.id,
                modelName: `${selectedStockItem.brand} ${selectedStockItem.model} ${selectedStockItem.quality}`,
                shopName: 'Manual Stock Update',
                status: adjType === 'Add' ? 'Added' : 'Removed',
                quantityChange: change,
                totalQuantity: change,
                itemCount: 1,
                currentStock: updatedItem.quantity,
                remarks: adjRemarks || `Manual ${adjType} of ${change} units`,
                createdDate: timestamp
            };
            await addInventoryLogToDB(log);
            showNotification(`Stock adjusted to ${newQuantity}`);
            setIsStockModalOpen(false);
        } catch (err) {
            showNotification('Error updating stock', 'error');
            loadAllData();
        } finally {
            setLoading(false);
            setIsUpdatingStock(false);
        }
    };

    const handlePriceUpdate = async (id: string, newPrice: number) => {
        if (isNaN(newPrice)) return;
        const itemToUpdate = items.find(i => i.id === id);
        if (!itemToUpdate) return;
        const updatedItem = { ...itemToUpdate, price: newPrice };
        setItems(prev => prev.map(i => i.id === id ? updatedItem : i));
        try {
            await updateInventoryItemInDB(updatedItem);
            showNotification('Unit price updated');
        } catch (error) {
            showNotification('Update failed', 'error');
            loadAllData();
        }
    };

    const handleStatusToggle = async (id: string) => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        const newStatus = item.status === 'Active' ? 'Inactive' : 'Active';
        const updatedItem = { ...item, status: newStatus };
        setItems(prev => prev.map(i => i.id === id ? updatedItem : i));
        try {
            await updateInventoryItemInDB(updatedItem);
            showNotification(`Visibility toggled to ${newStatus}`);
        } catch (error) {
            showNotification('Failed to update status', 'error');
            loadAllData();
        }
    };

    const handleMasterSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!masterInput.trim() || !masterModal.type) return;

        const val = masterInput.trim().toUpperCase();
        const pluralKeyMap: Record<string, keyof typeof masters> = {
            brand: 'brands',
            quality: 'qualities',
            category: 'categories',
            model: 'models',
            warehouse: 'warehouses'
        };
        const key = pluralKeyMap[masterModal.type];

        if (masters[key].some(item => item.toUpperCase() === val)) {
            showNotification(`${masterModal.type} entry already exists`, 'error');
            return;
        }

        setIsMasterSaving(true);
        try {
            await addMasterRecord(masterModal.type, val);
            const updatedList = await fetchMasterRecords(masterModal.type);
            setMasters(prev => ({ ...prev, [key]: updatedList }));
            setMasterInput('');
            showNotification(`New ${masterModal.type} recorded`);
        } finally {
            setIsMasterSaving(false);
        }
    };

    const handleCreateModel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createFormData.brand || !createFormData.model || !createFormData.category || !createFormData.warehouse) {
            showNotification('Missing required model attributes', 'error');
            return;
        }

        const isDuplicate = items.some(i => 
            i.brand.toUpperCase() === createFormData.brand?.toUpperCase() &&
            i.model.toUpperCase() === createFormData.model?.toUpperCase() &&
            i.quality.toUpperCase() === (createFormData.quality || 'OG').toUpperCase()
        );

        if (isDuplicate) {
            showNotification('Duplicate model configuration detected', 'error');
            return;
        }

        const newItem: ShopItem = {
            id: `mod-${Date.now()}`,
            brand: createFormData.brand!,
            model: createFormData.model!,
            quality: createFormData.quality || 'OG',
            category: createFormData.category || 'APEXFLOW',
            warehouse: createFormData.warehouse || 'APEXFLOW',
            price: Number(createFormData.price) || 0,
            quantity: 0,
            status: createFormData.status || 'Active',
            isNew: createFormData.isNew || 'No',
            location: '-'
        };

        try {
            await addInventoryItemToDB(newItem);
            setItems(prev => [newItem, ...prev]);
            setIsCreateModalOpen(false);
            setCreateFormData({ brand: '', model: '', quality: '', category: '', warehouse: '', price: 0, quantity: 0, status: 'Active', isNew: 'No', location: '-' });
            showNotification('New model initialized in warehouse');
        } catch (err) {
            showNotification('Creation failed', 'error');
        }
    };

    const handleExport = () => {
        if (processedItems.length === 0) return;
        const data = processedItems.map(item => ({
            'Brand': item.brand,
            'Quality': item.quality,
            'Category': item.category,
            'Model': item.model,
            'Warehouse': item.warehouse,
            'Price/Unit': item.price,
            'Inventory': item.quantity,
            'Status': item.status
        }));
        const ws = (window as any).XLSX.utils.json_to_sheet(data);
        const wb = (window as any).XLSX.utils.book_new();
        (window as any).XLSX.utils.book_append_sheet(wb, ws, "Inventory_Audit");
        (window as any).XLSX.writeFile(wb, `ApexFlow_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const filterWarehouses = ['All Warehouse', ...Array.from(new Set([
        ...masters.warehouses,
        ...items.map(i => i.warehouse || '')
    ])).filter(Boolean).sort()];

    const brandsList = (masters.brands?.length > 0) ? masters.brands : Array.from(new Set(items.map(i => i.brand))).filter(Boolean).sort();
    const qualitiesList = (masters.qualities?.length > 0) ? masters.qualities : Array.from(new Set(items.map(i => i.quality))).filter(Boolean).sort();
    const categoriesList = (masters.categories?.length > 0) ? masters.categories : Array.from(new Set(items.map(i => i.category))).filter(Boolean).sort();
    const modelsList = (masters.models?.length > 0) ? masters.models : Array.from(new Set(items.map(i => i.model))).filter(Boolean).sort();
    const uniqueWarehousesList = (masters.warehouses?.length > 0) ? masters.warehouses : Array.from(new Set(items.map(i => i.warehouse))).filter(w => w && w !== 'All Warehouse').sort();

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchesSearch = (item.model || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 (item.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 (item.quality || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesWarehouse = warehouseFilter === 'All Warehouse' || item.warehouse === warehouseFilter;
            const matchesStatus = statusFilter === 'All Status' || item.status === statusFilter;
            return matchesSearch && matchesWarehouse && matchesStatus;
        });
    }, [items, searchTerm, warehouseFilter, statusFilter]);

    const processedItems = useMemo(() => {
        let result = [...filteredItems];
        if (sortConfig.key && sortConfig.direction) {
            result.sort((a, b) => {
                const valA = (a[sortConfig.key!] as number) || 0;
                const valB = (b[sortConfig.key!] as number) || 0;
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            });
        }
        return result;
    }, [filteredItems, sortConfig]);

    // Pagination Logic
    const totalPages = Math.ceil(processedItems.length / itemsPerPage);
    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return processedItems.slice(startIndex, startIndex + itemsPerPage);
    }, [processedItems, currentPage, itemsPerPage]);

    const rangeStart = (currentPage - 1) * itemsPerPage + 1;
    const rangeEnd = Math.min(currentPage * itemsPerPage, processedItems.length);

    const selectStyles = "appearance-none bg-white border border-slate-200 rounded-[2rem] px-6 py-3.5 text-[10px] font-black uppercase tracking-widest outline-none pr-12 w-full cursor-pointer hover:bg-slate-50 transition-all focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 shadow-sm text-slate-600";
    const iconStyles = "absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none";

    return (
        <div className="flex flex-col space-y-8 animate-in fade-in duration-500 pb-10">

            {/* Redesigned Header Area */}
            <div className="flex flex-col xl:flex-row items-center justify-between gap-6 no-print">
                <div className="flex items-center gap-5 w-full xl:w-auto">
                    <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100 shrink-0">
                        <Database size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">Catalog Intelligence</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Manage Models & Centralized Inventory</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
                    {['brand', 'quality', 'category', 'model', 'warehouse'].map(type => (
                        <button 
                            key={type}
                            onClick={() => setMasterModal({ isOpen: true, type: type as any })}
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-sm transition-all flex items-center gap-2"
                        >
                            <Settings2 size={12} strokeWidth={3} /> {type}s
                        </button>
                    ))}
                    <div className="w-px h-8 bg-slate-200 mx-2 hidden sm:block"></div>
                    <button onClick={handleExport} className="p-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-90" title="Export to XLSX">
                        <FileSpreadsheet size={20} strokeWidth={2.5} />
                    </button>
                    <button onClick={() => setIsCreateModalOpen(true)} className="px-8 py-3.5 bg-indigo-600 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 active:scale-95 transition-all flex items-center gap-2">
                        <Plus size={16} strokeWidth={4} /> Register Model
                    </button>
                </div>
            </div>

            {/* Filter Hub */}
            <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-4 items-center">
                <div className="relative flex-1 group w-full">
                    <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Search models..." 
                        value={searchTerm} 
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                        className="w-full pl-14 pr-8 py-4 bg-slate-50/50 border border-slate-200 rounded-[2rem] text-[13px] font-bold uppercase outline-none focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner" 
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    <div className="relative min-w-[160px]">
                        <select value={warehouseFilter} onChange={(e) => { setWarehouseFilter(e.target.value); setCurrentPage(1); }} className={selectStyles}>
                            {filterWarehouses.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                        <ChevronDown size={14} className={iconStyles} />
                    </div>
                    <div className="relative min-w-[160px]">
                        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className={selectStyles}>
                            <option value="All Status">All Status</option>
                            <option value="Active">Visible</option>
                            <option value="Inactive">Hidden</option>
                        </select>
                        <ChevronDown size={14} className={iconStyles} />
                    </div>
                    <button onClick={handleRefresh} disabled={isRefreshing} className="p-4 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-indigo-600 transition-all active:rotate-180 duration-700 shadow-sm">
                        <RefreshCw size={20} strokeWidth={2.5} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Inventory Table Card */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left table-fixed min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="w-[10%] px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Brand</th>
                                <th className="w-[8%] px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Quality</th>
                                <th className="w-[10%] px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Category</th>
                                <th className="w-[20%] px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Model Name</th>
                                <th className="w-[10%] px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Warehouse</th>
                                <th className="w-[12%] px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center cursor-pointer" onClick={() => setSortConfig({key: 'price', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'})}>
                                    <div className="flex items-center justify-center gap-1.5 group">Unit Price <ArrowUpDown size={12} className="opacity-40 group-hover:opacity-100" /></div>
                                </th>
                                <th className="w-[10%] px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center cursor-pointer" onClick={() => setSortConfig({key: 'quantity', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'})}>
                                    <div className="flex items-center justify-center gap-1.5 group">Stock <ArrowUpDown size={12} className="opacity-40 group-hover:opacity-100" /></div>
                                </th>
                                <th className="w-[8%] px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Visible</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={8} className="py-40 text-center"><Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} /><p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mt-4">Syncing Encrypted Stock...</p></td></tr>
                            ) : paginatedItems.length === 0 ? (
                                <tr><td colSpan={8} className="py-40 text-center"><Package size={48} className="text-slate-100 mx-auto mb-4" /><p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">No matching models found in database</p></td></tr>
                            ) : paginatedItems.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-all group">
                                    <td className="px-4 py-3">
                                        <span className="inline-flex px-2 py-0.5 rounded-lg border border-indigo-100 text-indigo-600 bg-indigo-50 font-black text-[9px] uppercase tracking-wider">{item.brand}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="inline-flex px-2 py-0.5 rounded-lg border border-emerald-100 text-emerald-600 bg-emerald-50 font-black text-[9px] uppercase tracking-wider">{item.quality}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight truncate">{item.category}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => onViewModel(item)} className="text-[12px] font-black text-slate-800 hover:text-indigo-600 transition-colors text-left uppercase leading-tight tracking-tight group-hover:underline truncate w-full">{item.model}</button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5 text-slate-400">
                                            <Layers size={10} strokeWidth={3} />
                                            <span className="text-[10px] font-black uppercase tracking-tight truncate">{item.warehouse}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="relative inline-block w-20">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 text-[10px] font-black pointer-events-none">₹</span>
                                            <input 
                                                type="number" 
                                                step="0.1"
                                                defaultValue={(item.price || 0).toFixed(1)} 
                                                onBlur={(e) => handlePriceUpdate(item.id, parseFloat(e.target.value))}
                                                className="w-full pl-5 pr-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[12px] font-black text-emerald-600 text-center outline-none focus:bg-white focus:border-indigo-400 transition-all shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button 
                                            onClick={() => openStockAdjustment(item)}
                                            className={`inline-flex px-3 py-1.5 rounded-xl border font-black text-[12px] tracking-tighter transition-all active:scale-90 hover:shadow-sm ${
                                                (item.quantity || 0) > 50 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                                (item.quantity || 0) > 0 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                                            }`}
                                        >
                                            {item.quantity || 0} PCS
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button 
                                            onClick={() => handleStatusToggle(item.id)}
                                            className={`p-1.5 rounded-lg transition-all active:scale-90 shadow-sm border ${item.status === 'Active' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                                            title={item.status === 'Active' ? 'Mark Hidden' : 'Mark Visible'}
                                        >
                                            {item.status === 'Active' ? <CheckCircle size={16} strokeWidth={3} /> : <AlertCircle size={16} strokeWidth={3} />}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!loading && processedItems.length > 0 && (
                    <div className="px-10 py-6 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 shrink-0">
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rows per Page</span>
                                <div className="relative">
                                    <select 
                                        value={itemsPerPage} 
                                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                        className="appearance-none bg-white border border-slate-200 rounded-xl px-5 py-2 pr-10 text-[11px] font-black text-slate-700 outline-none focus:border-indigo-500 shadow-sm cursor-pointer"
                                    >
                                        {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Showing <span className="text-slate-900">{rangeStart} - {rangeEnd}</span> of <span className="text-slate-900">{processedItems.length}</span> Models
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                            >
                                <ChevronLeft size={18} strokeWidth={3} />
                            </button>

                            <div className="flex items-center gap-1.5">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum = i + 1;
                                    if (totalPages > 5 && currentPage > 3) {
                                        pageNum = currentPage - 3 + i + 1;
                                        if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`w-10 h-10 rounded-xl text-[11px] font-black transition-all shadow-sm active:scale-95 ${currentPage === pageNum ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            <button 
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                            >
                                <ChevronRight size={18} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {masterModal.isOpen && masterModal.type && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg"><Settings2 size={24} strokeWidth={3} /></div><div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">Entity Manager</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Manage {masterModal.type} Database</p></div></div>
                            <button onClick={() => setMasterModal({ isOpen: false, type: null })} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all hover:rotate-90"><X size={24} /></button>
                        </div>
                        <div className="p-10 space-y-8">
                            <form onSubmit={handleMasterSave} className="space-y-4"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Add New {masterModal.type}</label><div className="flex gap-2"><input autoFocus type="text" value={masterInput} onChange={e => setMasterInput(e.target.value)} placeholder={`Enter ${masterModal.type} name...`} className="flex-1 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold uppercase outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner"/><button type="submit" disabled={isMasterSaving || !masterInput.trim()} className="px-6 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50 transition-all">{isMasterSaving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={24} strokeWidth={4} />}</button></div></form>
                            <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">{(() => { const pluralKeyMap: Record<string, keyof typeof masters> = { brand: 'brands', quality: 'qualities', category: 'categories', model: 'models', warehouse: 'warehouses' }; const list = masters[pluralKeyMap[masterModal.type!]] || []; return list.map(val => (<div key={val} className="flex items-center justify-between px-5 py-4 bg-white rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-all shadow-sm"><span className="text-xs font-black text-slate-700 uppercase tracking-tight">{val}</span></div>)); })()}</div>
                        </div>
                    </div>
                </div>
            )}

            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"><div className="flex items-center gap-4"><div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0"><Box size={28} /></div><div><h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">Model Initialization</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Search and link hardware specifications</p></div></div><button onClick={() => setIsCreateModalOpen(false)} className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all hover:rotate-90 shadow-sm"><X size={24} /></button></div>
                        <form onSubmit={handleCreateModel} className="p-10"><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><ModalField label="Brand Identifier" required><SearchableSelect options={brandsList} value={createFormData.brand || ''} placeholder="Find brand..." onChange={val => setCreateFormData({ ...createFormData, brand: val })} /></ModalField><ModalField label="Quality Grade" required><SearchableSelect options={qualitiesList} value={createFormData.quality || ''} placeholder="Find quality..." onChange={val => setCreateFormData({ ...createFormData, quality: val })} /></ModalField><ModalField label="Inventory Category" required><SearchableSelect options={categoriesList} value={createFormData.category || ''} placeholder="Find category..." onChange={val => setCreateFormData({ ...createFormData, category: val })} /></ModalField><ModalField label="Specific Model Name" required><SearchableSelect options={modelsList} value={createFormData.model || ''} placeholder="Find model..." onChange={val => setCreateFormData({ ...createFormData, model: val })} /></ModalField><ModalField label="Standard Base Price (₹)" required><div className="relative"><span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-sm">₹</span><input type="number" step="0.1" required value={createFormData.price} onChange={e => setCreateFormData({ ...createFormData, price: Number(e.target.value) })} className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold uppercase text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner" placeholder="0.0"/></div></ModalField><ModalField label="Destination Warehouse" required><SearchableSelect options={masters.warehouses} value={createFormData.warehouse || ''} placeholder="Select warehouse..." onChange={val => setCreateFormData({ ...createFormData, warehouse: val })} /></ModalField></div><div className="flex justify-end gap-4 pt-12"><button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-10 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95">Discard</button><button type="submit" className="px-14 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 border border-indigo-400/20">Commit to Cloud Catalog</button></div></form>
                    </div>
                </div>
            )}

            {isStockModalOpen && selectedStockItem && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
                                    <Package size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none">Stock Correction</h3>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedStockItem.brand} - {selectedStockItem.model}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsStockModalOpen(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all hover:rotate-90">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleStockAdjustmentSubmit} className="p-6 space-y-6">
                            <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                                <button type="button" onClick={() => setAdjType('Add')} className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all ${adjType === 'Add' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                                    <PlusCircle size={14} strokeWidth={3}/> Restock
                                </button>
                                <button type="button" onClick={() => setAdjType('Remove')} className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all ${adjType === 'Remove' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                                    <MinusCircle size={14} strokeWidth={3}/> Deduct
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl shadow-inner">
                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">Current</p>
                                    <p className="text-xl font-black text-slate-900 tracking-tighter">{selectedStockItem.quantity || 0}</p>
                                </div>
                                <div className={`p-4 border rounded-2xl shadow-sm transition-colors duration-500 ${adjType === 'Add' ? 'bg-indigo-50 border-indigo-100' : 'bg-rose-50 border-rose-100'}`}>
                                    <p className={`text-[8px] font-black uppercase mb-1 tracking-widest ${adjType === 'Add' ? 'text-indigo-400' : 'text-rose-400'}`}>Forecast</p>
                                    <p className={`text-xl font-black tracking-tighter ${adjType === 'Add' ? 'text-indigo-600' : 'text-rose-600'}`}>
                                        {adjType === 'Add' ? ((selectedStockItem.quantity || 0) + (parseInt(adjQty) || 0)) : ((selectedStockItem.quantity || 0) - (parseInt(adjQty) || 0))}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Quantity</label>
                                    <input 
                                        type="number" 
                                        required 
                                        min="1" 
                                        value={adjQty} 
                                        onChange={(e) => setAdjQty(e.target.value)} 
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-2xl font-black outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner text-center" 
                                        autoFocus 
                                        placeholder="0" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Remarks</label>
                                    <textarea 
                                        placeholder="Enter reason..." 
                                        value={adjRemarks} 
                                        onChange={(e) => setAdjRemarks(e.target.value)} 
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:bg-white focus:border-indigo-500 transition-all min-h-[80px] resize-none shadow-inner" 
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsStockModalOpen(false)} className="flex-1 py-3 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">Discard</button>
                                <button type="submit" disabled={isUpdatingStock || !adjQty} className={`flex-[2] py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${adjType === 'Add' ? 'bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700' : 'bg-rose-600 shadow-rose-100 hover:bg-rose-700'} disabled:opacity-50`}>
                                    {isUpdatingStock ? <Loader2 className="animate-spin" size={14} /> : (adjType === 'Add' ? 'Commit Restock' : 'Commit Removal')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const SearchableSelect: React.FC<{ options: string[], value: string, onChange: (val: string) => void, placeholder: string }> = ({ options, value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
    useEffect(() => { const handleClickOutside = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) { setIsOpen(false); setSearch(''); } }; document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }, []);
    useEffect(() => { if (isOpen && inputRef.current) inputRef.current.focus(); }, [isOpen]);
    return (<div className="relative" ref={containerRef}><div onClick={() => setIsOpen(!isOpen)} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold uppercase text-slate-800 outline-none flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-all shadow-inner"><span className={value ? 'text-slate-800' : 'text-slate-300'}>{value || placeholder}</span><ChevronDown size={18} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></div>{isOpen && (<div className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-200 rounded-[2rem] shadow-2xl z-[160] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/5"><div className="p-4 border-b border-slate-100 bg-slate-50/50"><div className="relative group"><Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" /><input ref={inputRef} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase outline-none focus:ring-4 focus:ring-indigo-50/10 transition-all" /></div></div><div className="max-h-60 overflow-y-auto custom-scrollbar bg-white">{filtered.length === 0 ? (<div className="py-12 text-center text-slate-300 text-[10px] font-black uppercase tracking-widest">No entries</div>) : (filtered.map(opt => (<button key={opt} type="button" onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }} className={`w-full text-left px-7 py-3.5 hover:bg-indigo-50 transition-all flex items-center justify-between group ${value === opt ? 'bg-indigo-50/50' : ''}`}><span className={`text-xs font-black uppercase tracking-tight ${value === opt ? 'text-indigo-600' : 'text-slate-600 group-hover:text-indigo-600'}`}>{opt}</span>{value === opt && <Check size={14} className="text-indigo-600" strokeWidth={4} />}</button>)))}</div></div>)}</div>);
};

const ModalField: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
    <div className="space-y-2.5"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{label} {required && <span className="text-rose-500">*</span>}</label>{children}</div>
);

export default ShopModelList;
