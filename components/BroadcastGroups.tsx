import React, { useState, useMemo, useEffect } from 'react';
import { 
    Search, 
    RefreshCw, 
    Plus, 
    Eye, 
    Users, 
    Edit, 
    Trash2, 
    Radio,
    X,
    UserPlus,
    UserMinus,
    Loader2,
    Calendar,
    Target,
    Info
} from 'lucide-react';
import { fetchCustomers, fetchGroups, addGroupToDB, updateGroupInDB, deleteGroupFromDB } from '../services/db';
import { Customer } from '../types';
import { useNotification } from '../context/NotificationContext';

interface BroadcastGroup {
    id: string;
    name: string;
    description: string;
    members: string[]; // Array of Customer IDs
    createdDate: string;
}

const BroadcastGroups: React.FC = () => {
    const [groups, setGroups] = useState<BroadcastGroup[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const { showNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [dbGroups, dbCustomers] = await Promise.all([fetchGroups(), fetchCustomers()]);
            setGroups(dbGroups || []);
            setCustomers(dbCustomers || []);
        } catch (e) {
            showNotification('Error loading broadcast channels', 'error');
        } finally {
            setLoading(false);
        }
    };

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<BroadcastGroup | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [memberSearchTerm, setMemberSearchTerm] = useState('');

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadData();
        setIsRefreshing(false);
        showNotification('Syncing broadcast channels');
    };

    const openCreateModal = () => {
        setIsEditMode(false);
        setFormData({ name: '', description: '' });
        setSelectedGroup(null);
        setIsFormModalOpen(true);
    };

    const openEditModal = (group: BroadcastGroup) => {
        setIsEditMode(true);
        setSelectedGroup(group);
        setFormData({ name: group.name, description: group.description });
        setIsFormModalOpen(true);
    };

    const handleSaveGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        const dateStr = new Date().toLocaleDateString('en-GB');

        if (isEditMode && selectedGroup) {
            const updatedGroup = { ...selectedGroup, name: formData.name, description: formData.description };
            setGroups(prev => prev.map(g => g.id === selectedGroup.id ? updatedGroup : g));
            await updateGroupInDB(updatedGroup);
            showNotification('Group metadata updated');
        } else {
            const newGroup: BroadcastGroup = {
                id: Date.now().toString(),
                name: formData.name,
                description: formData.description,
                members: [],
                createdDate: dateStr
            };
            setGroups(prev => [newGroup, ...prev]);
            await addGroupToDB(newGroup);
            showNotification('New broadcast channel created');
        }
        setIsFormModalOpen(false);
    };

    const handleDeleteGroup = async (id: string) => {
        if(confirm('Are you sure you want to permanently revoke this broadcast group?')) {
            setGroups(prev => prev.filter(g => g.id !== id));
            await deleteGroupFromDB(id);
            showNotification('Broadcast group removed', 'error');
        }
    };

    const openViewModal = (group: BroadcastGroup) => {
        setSelectedGroup(group);
        setIsViewModalOpen(true);
    };

    const openManageMembers = (group: BroadcastGroup) => {
        setSelectedGroup(group);
        setMemberSearchTerm('');
        setIsMembersModalOpen(true);
    };

    const handleAddMember = async (customerId: string) => {
        if (!selectedGroup) return;
        const updatedGroup = { ...selectedGroup, members: [...(selectedGroup.members || []), customerId] };
        setSelectedGroup(updatedGroup);
        setGroups(prev => prev.map(g => g.id === selectedGroup.id ? updatedGroup : g));
        await updateGroupInDB(updatedGroup);
        showNotification('Member added to group');
    };

    const handleRemoveMember = async (customerId: string) => {
        if (!selectedGroup) return;
        const updatedGroup = { 
            ...selectedGroup, 
            members: (selectedGroup.members || []).filter(id => id !== customerId) 
        };
        setSelectedGroup(updatedGroup);
        setGroups(prev => prev.map(g => g.id === selectedGroup.id ? updatedGroup : g));
        await updateGroupInDB(updatedGroup);
        showNotification('Member removed', 'info');
    };

    const filteredGroups = useMemo(() => {
        return groups.filter(group => 
            group.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            group.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [groups, searchTerm]);

    const availableCustomers = useMemo(() => {
        if (!selectedGroup) return [];
        const groupMemberIds = selectedGroup.members || [];
        return customers.filter(c => 
            !groupMemberIds.includes(c.id) && 
            (c.name?.toLowerCase().includes(memberSearchTerm.toLowerCase()) || c.phone?.includes(memberSearchTerm))
        );
    }, [selectedGroup, memberSearchTerm, customers]);

    const currentMembers = useMemo(() => {
        if (!selectedGroup) return [];
        const groupMemberIds = selectedGroup.members || [];
        return customers.filter(c => groupMemberIds.includes(c.id));
    }, [selectedGroup, customers]);

    return (
        <div className="flex flex-col space-y-8 animate-in fade-in duration-500 pb-10">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 no-print">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-violet-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-violet-100 shrink-0">
                        <Radio size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Broadcast Channels</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Targeted Communication Management</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="flex-1 lg:flex-none flex items-center gap-4 bg-white border border-slate-200 px-8 py-3.5 rounded-[2rem] shadow-sm">
                        <div className="w-8 h-8 bg-violet-50 text-violet-500 rounded-full flex items-center justify-center"><Target size={16} /></div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Active Groups</p>
                            <p className="text-xl font-black text-slate-800 tracking-tighter leading-none">{groups.length}</p>
                        </div>
                    </div>
                    <button onClick={openCreateModal} className="px-10 py-4 bg-violet-600 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-violet-200 active:scale-95 transition-all hover:bg-violet-700">
                        <Plus size={16} className="mr-2 inline" strokeWidth={4} /> Create Channel
                    </button>
                </div>
            </div>

            <div className="relative flex-1 group no-print">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-500 transition-colors">
                    <Search size={20} strokeWidth={2.5} />
                </div>
                <input type="text" placeholder="Search by channel name or description..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-14 py-4 bg-white border border-slate-200 rounded-[2.5rem] text-[13px] font-bold uppercase tracking-tight text-slate-800 outline-none focus:ring-8 focus:ring-violet-500/5 transition-all shadow-sm" />
                <button onClick={handleRefresh} className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 text-slate-300 hover:text-violet-500 transition-all active:rotate-180 duration-700">
                    <RefreshCw size={20} strokeWidth={2.5} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm no-print">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left table-fixed min-w-[900px]">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="w-[35%] px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Channel Info</th>
                                <th className="w-[15%] px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Reach</th>
                                <th className="w-[20%] px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Creation Date</th>
                                <th className="w-[30%] px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={4} className="py-40 text-center"><Loader2 className="animate-spin text-violet-500 mx-auto" size={32} /><p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mt-4">Syncing Encrypted Channels...</p></td></tr>
                            ) : filteredGroups.length === 0 ? (
                                <tr><td colSpan={4} className="py-40 text-center"><Radio size={48} className="text-slate-100 mx-auto mb-4" /><p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">No active broadcast groups</p></td></tr>
                            ) : filteredGroups.map((group) => (
                                <tr key={group.id} className="hover:bg-slate-50/50 transition-all group">
                                    <td className="px-10 py-6">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center shadow-inner shrink-0 group-hover:scale-110 transition-transform"><Users size={24} /></div>
                                            <div className="min-w-0">
                                                <p className="text-[15px] font-black text-slate-900 uppercase tracking-tight truncate leading-none mb-1.5">{group.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{group.description || 'Global Audience'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-6 text-center">
                                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-600 rounded-2xl border border-violet-100">
                                            <Target size={14} strokeWidth={2.5} />
                                            <span className="text-sm font-black tracking-tight">{(group.members || []).length} Users</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-6">
                                        <div className="flex items-center gap-2 text-slate-400"><Calendar size={14} /><span className="text-[11px] font-black uppercase tracking-widest">{group.createdDate}</span></div>
                                    </td>
                                    <td className="px-10 py-6 text-right">
                                        <div className="flex items-center justify-end gap-2.5">
                                            <button onClick={() => openViewModal(group)} className="p-3 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-90"><Eye size={18} strokeWidth={2.5}/></button>
                                            <button onClick={() => openManageMembers(group)} className="p-3 bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-90"><UserPlus size={18} strokeWidth={2.5}/></button>
                                            <button onClick={() => openEditModal(group)} className="p-3 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-90"><Edit size={18} strokeWidth={2.5}/></button>
                                            <button onClick={() => handleDeleteGroup(group.id)} className="p-3 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all shadow-sm active:scale-90"><Trash2 size={18} strokeWidth={2.5}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODALS remain similar with safety guards added */}
            {isFormModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-lg">{isEditMode ? <Edit size={24} /> : <Plus size={24} />}</div><div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{isEditMode ? 'Modify Channel' : 'New Broadcast'}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Configuration Tool</p></div></div>
                            <button onClick={() => setIsFormModalOpen(false)} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all"><X size={24}/></button>
                        </div>
                        <form onSubmit={handleSaveGroup} className="p-10 space-y-8">
                            <div className="space-y-2"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Channel Label <span className="text-rose-500">*</span></label><input type="text" required autoFocus value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold uppercase outline-none focus:bg-white focus:border-violet-500 focus:ring-8 focus:ring-violet-500/5 transition-all" placeholder="e.g. VIP DISTRIBUTORS..." /></div>
                            <div className="space-y-2"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Channel Description</label><textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold uppercase outline-none focus:bg-white focus:border-violet-500 transition-all min-h-[120px] resize-none" placeholder="Define the audience reach..." /></div>
                            <div className="flex gap-4 pt-2"><button type="button" onClick={() => setIsFormModalOpen(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest">Discard</button><button type="submit" className="flex-[2] py-4 bg-violet-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">{isEditMode ? 'Update' : 'Initialize'}</button></div>
                        </form>
                    </div>
                </div>
            )}

            {isViewModalOpen && selectedGroup && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-violet-50/30">
                            <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-lg"><Eye size={24} /></div><div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{selectedGroup.name}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Channel Intelligence</p></div></div>
                            <button onClick={() => setIsViewModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-all"><X size={24} /></button>
                        </div>
                        <div className="p-10 space-y-8">
                            <div><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Info size={12}/> Description</h4><p className="text-[13px] font-bold text-slate-700 bg-slate-50 p-6 rounded-3xl border border-slate-100 uppercase tracking-tight leading-relaxed">{selectedGroup.description || 'NO DESCRIPTION SPECIFIED.'}</p></div>
                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between"><span>Verified Members Reach</span><span className="text-violet-600">Total: {(selectedGroup.members || []).length}</span></h4>
                                <div className="border border-slate-100 rounded-3xl overflow-hidden max-h-[250px] overflow-y-auto custom-scrollbar bg-slate-50/30 p-2">
                                    {currentMembers.length > 0 ? (
                                        <div className="space-y-2">{currentMembers.map(member => (<div key={member.id} className="px-5 py-4 bg-white rounded-2xl border border-slate-50 flex items-center justify-between shadow-sm"><div><p className="text-[12px] font-black text-slate-800 uppercase tracking-tight">{member.name}</p><p className="text-[10px] font-bold text-slate-400 tracking-tighter">{member.phone}</p></div><span className={`text-[9px] font-black px-3 py-1 rounded-full border ${member.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400'}`}>{member.status.toUpperCase()}</span></div>))}</div>
                                    ) : (<div className="p-12 text-center text-slate-300 font-black text-[10px] uppercase tracking-[0.4em]">Audience Empty</div>)}
                                </div>
                            </div>
                        </div>
                        <div className="px-10 py-6 bg-slate-50 border-t border-slate-100 flex justify-end"><button onClick={() => setIsViewModalOpen(false)} className="px-8 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 shadow-sm active:scale-95">Done</button></div>
                    </div>
                </div>
            )}

            {isMembersModalOpen && selectedGroup && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[160] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                            <div className="flex items-center gap-5"><div className="w-14 h-14 bg-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><UserPlus size={28} /></div><div><h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">Manage Audience</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Channel: <span className="text-violet-600">{selectedGroup.name}</span></p></div></div>
                            <button onClick={() => setIsMembersModalOpen(false)} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all hover:rotate-90 shadow-sm"><X size={24}/></button>
                        </div>
                        <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-slate-50/30">
                            <div className="flex-1 flex flex-col border-r border-slate-100 p-8 min-h-0">
                                <div className="mb-6"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 flex items-center justify-between px-2"><span>Global Repository</span><span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-[9px]">{availableCustomers.length} Available</span></h4><div className="relative group"><input type="text" value={memberSearchTerm} onChange={(e) => setMemberSearchTerm(e.target.value)} placeholder="Find customer to enlist..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold uppercase tracking-tight outline-none focus:ring-8 focus:ring-violet-500/5 transition-all shadow-sm"/><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" /></div></div>
                                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">{availableCustomers.map(customer => (<div key={customer.id} className="bg-white p-5 rounded-3xl border border-slate-50 shadow-sm flex items-center justify-between hover:border-violet-300 transition-all group"><div className="min-w-0 pr-4"><p className="text-[13px] font-black text-slate-800 uppercase tracking-tight truncate">{customer.name}</p><p className="text-[10px] font-bold text-slate-400 tracking-tighter uppercase">{customer.phone} | {customer.city}</p></div><button onClick={() => handleAddMember(customer.id)} className="p-3 bg-violet-50 text-violet-600 rounded-2xl hover:bg-violet-600 hover:text-white transition-all shadow-sm active:scale-90 shrink-0"><UserPlus size={18}/></button></div>))}</div>
                            </div>
                            <div className="flex-1 flex flex-col p-8 min-h-0 bg-white">
                                <div className="mb-6"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 flex items-center justify-between px-2"><span>Subscribed Audience</span><span className="bg-violet-600 text-white px-3 py-1 rounded-full text-[9px] shadow-lg shadow-violet-100">{currentMembers.length} Enlisted</span></h4><div className="h-[52px] flex items-center px-6 bg-violet-50/50 rounded-2xl border border-violet-100"><Target size={18} className="text-violet-500 mr-3 shrink-0" /><span className="text-[11px] text-violet-700 font-black uppercase tracking-widest">Active Broadcasting Target Area</span></div></div>
                                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">{currentMembers.map(customer => (<div key={customer.id} className="bg-violet-50/20 p-5 rounded-3xl border border-slate-50 shadow-sm flex items-center justify-between hover:border-rose-200 transition-all group"><div className="min-w-0 pr-4"><p className="text-[13px] font-black text-slate-800 uppercase tracking-tight truncate">{customer.name}</p><p className="text-[10px] font-bold text-violet-400 tracking-tighter uppercase">{customer.phone}</p></div><button onClick={() => handleRemoveMember(customer.id)} className="p-3 bg-white text-slate-400 border border-slate-100 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-90 shadow-sm shrink-0"><UserMinus size={18}/></button></div>))}</div>
                            </div>
                        </div>
                        <div className="px-10 py-6 bg-white border-t border-slate-100 flex justify-end shrink-0"><button onClick={() => setIsMembersModalOpen(false)} className="px-12 py-4 bg-slate-900 text-white font-black rounded-2xl text-[11px] uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all active:scale-95">Secure Changes</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BroadcastGroups;