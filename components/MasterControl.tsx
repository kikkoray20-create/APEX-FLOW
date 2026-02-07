import React, { useState, useEffect, useMemo } from 'react';
import { 
    Smartphone, 
    Loader2, 
    X, 
    UserPlus, 
    Shield, 
    Edit2,
    Lock,
    Globe,
    Settings,
    Wifi,
    Server,
    Cpu,
    RefreshCw,
    ShieldAlert,
    Zap,
    Activity
} from 'lucide-react';
import { User } from '../types';
import { fetchUsers, addUserToDB, updateUserInDB } from '../services/db';
import { useNotification } from '../context/NotificationContext';

const MasterControl: React.FC = () => {
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { showNotification } = useNotification();

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState<User | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        password: '',
        active: true
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const users = await fetchUsers();
            setAllUsers(users || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadData();
        setIsRefreshing(false);
        showNotification('System Records Synchronized');
    };

    const superAdmins = useMemo(() => {
        return allUsers.filter(u => u.role === 'Super Admin' && u.id !== 'root-master');
    }, [allUsers]);

    const handleOpenRegister = () => {
        setIsEditMode(false);
        setFormData({ name: '', phone: '', password: '', active: true });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (user: User) => {
        setIsEditMode(true);
        setSelectedAdmin(user);
        setFormData({
            name: user.name,
            phone: user.phone,
            password: user.password || '',
            active: user.active
        });
        setIsModalOpen(true);
    };

    const handleSaveAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.phone || !formData.password) {
            showNotification('Required fields missing', 'error');
            return;
        }

        try {
            if (isEditMode && selectedAdmin) {
                const updated = { ...selectedAdmin, ...formData };
                await updateUserInDB(updated);
                setAllUsers(prev => prev.map(u => u.id === selectedAdmin.id ? updated : u));
                showNotification('Super User parameters updated');
            } else {
                const instanceId = `inst-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                const newAdmin: User = {
                    id: `u-sa-${Date.now()}`,
                    instanceId: instanceId,
                    name: formData.name.toUpperCase(),
                    phone: formData.phone,
                    password: formData.password,
                    role: 'Super Admin',
                    active: true,
                    location: 'MASTER NODE'
                };
                await addUserToDB(newAdmin);
                setAllUsers(prev => [...prev, newAdmin]);
                showNotification(`Super User ${instanceId} created`);
            }
            setIsModalOpen(false);
        } catch (err) {
            showNotification('Registration failed', 'error');
        }
    };

    const handleStatusToggle = async (user: User) => {
        const updated = { ...user, active: !user.active };
        await updateUserInDB(updated);
        setAllUsers(prev => prev.map(u => u.id === user.id ? updated : u));
        showNotification(`Access ${updated.active ? 'enabled' : 'revoked'}`);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 no-print">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
                        <ShieldAlert size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Architect Console</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Node Orchestration</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <button 
                        onClick={handleRefresh}
                        className="p-4 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-indigo-600 shadow-sm transition-all active:rotate-180 duration-700"
                    >
                        <RefreshCw size={22} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                    <button 
                        onClick={handleOpenRegister}
                        className="flex-1 lg:flex-none flex items-center justify-center px-10 py-4 bg-slate-900 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all hover:bg-slate-800"
                    >
                        <UserPlus size={16} className="mr-2" strokeWidth={4} /> Register Super User
                    </button>
                </div>
            </div>

            {/* Registry Table */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
                <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <Activity size={18} className="text-indigo-600" />
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Active Super Admin Nodes</h3>
                    </div>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left table-fixed min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="w-[25%] px-10 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Node Identity</th>
                                <th className="w-[15%] px-10 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Instance ID</th>
                                <th className="w-[20%] px-10 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact</th>
                                <th className="w-[15%] px-10 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                <th className="w-[15%] px-10 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={5} className="py-24 text-center"><Loader2 className="animate-spin text-slate-400 mx-auto" size={32} /></td></tr>
                            ) : superAdmins.length === 0 ? (
                                <tr><td colSpan={5} className="py-24 text-center text-slate-300 font-black text-[10px] uppercase tracking-[0.4em]">No secondary nodes detected</td></tr>
                            ) : (
                                superAdmins.map((admin) => (
                                    <tr key={admin.id} className="hover:bg-slate-50/50 transition-all group">
                                        <td className="px-10 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs">{admin.name.charAt(0)}</div>
                                                <span className="text-[13px] font-black text-slate-800 uppercase tracking-tight">{admin.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-5"><span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">{admin.instanceId}</span></td>
                                        <td className="px-10 py-5"><span className="text-[12px] font-bold text-slate-600">{admin.phone}</span></td>
                                        <td className="px-10 py-5">
                                            <button 
                                                onClick={() => handleStatusToggle(admin)}
                                                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${admin.active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}
                                            >
                                                {admin.active ? 'Active' : 'Disabled'}
                                            </button>
                                        </td>
                                        <td className="px-10 py-5 text-right">
                                            <button onClick={() => handleOpenEdit(admin)} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl transition-all shadow-sm">
                                                <Edit2 size={16} strokeWidth={3} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
                                    {isEditMode ? <Settings size={24} /> : <UserPlus size={24} />}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">{isEditMode ? 'Modify Admin' : 'Deploy Super User'}</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Node Access Registry</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all hover:rotate-90"><X size={20} /></button>
                        </div>
                        
                        <form onSubmit={handleSaveAdmin} className="p-10 space-y-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Legal Name</label>
                                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold uppercase outline-none focus:bg-white focus:border-slate-900 shadow-inner" placeholder="ADMIN NAME..." />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mobile Access ID</label>
                                <div className="relative">
                                    <input required type="tel" maxLength={10} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold outline-none focus:bg-white shadow-inner" placeholder="0000000000" />
                                    <Smartphone size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Private PIN Code</label>
                                <div className="relative">
                                    <input required type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold outline-none focus:bg-white shadow-inner font-mono tracking-widest" placeholder="••••" />
                                    <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button>
                                <button type="submit" className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">Submit Node</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MasterControl;