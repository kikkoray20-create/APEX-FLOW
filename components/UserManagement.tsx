
import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole } from '../types';
import { 
    Phone, 
    Edit2, 
    ChevronDown, 
    Lock, 
    X, 
    MapPin, 
    UserCog, 
    Plus, 
    RefreshCw, 
    Search, 
    Loader2, 
    Shield, 
    Users, 
    Smartphone,
    ShieldCheck,
    CheckCircle2,
    ShieldAlert,
    Activity,
    UserCheck,
    LockIcon,
    KeyRound,
    // Added UserPlus import to fix "Cannot find name 'UserPlus'" error
    UserPlus,
    // Aliased User icon as UserIcon to fix naming conflict with User type
    User as UserIcon
} from 'lucide-react';
import { fetchUsers, addUserToDB, updateUserInDB } from '../services/db';
import { useNotification } from '../context/NotificationContext';

interface UserManagementProps {
    currentUser: User;
}

const ROLES: UserRole[] = ['Super Admin', 'Picker', 'Checker', 'Dispatcher', 'GR'];

const UserManagement: React.FC<UserManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { showNotification } = useNotification();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    role: 'Picker' as UserRole,
    active: true,
    location: '',
  });

  useEffect(() => {
    loadUsers();
  }, [currentUser]);

  const loadUsers = async () => {
    setLoading(true);
    try {
        const data = await fetchUsers(currentUser?.instanceId);
        setUsers(data);
    } finally {
        setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadUsers();
    setIsRefreshing(false);
    showNotification('Team permissions synchronized');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      password: '',
      role: 'Picker',
      active: true,
      location: '',
    });
    setEditingUser(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      phone: user.phone,
      password: user.password || '',
      role: user.role,
      active: user.active,
      location: user.location || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!formData.name || !formData.phone || !formData.password) {
      showNotification('Fill all required identity fields', 'error');
      return;
    }

    try {
        if (editingUser) {
          const updatedUser: User = { ...editingUser, ...formData };
          setUsers(prev => prev.map(u => u.id === editingUser.id ? updatedUser : u));
          await updateUserInDB(updatedUser);
          showNotification('Operator profile updated');
        } else {
          const newUser: User = {
            id: `u${Date.now()}`, 
            instanceId: currentUser?.instanceId,
            ...formData
          };
          setUsers(prev => [...prev, newUser]);
          await addUserToDB(newUser);
          showNotification('New operator enlisted successfully');
        }
        setIsModalOpen(false);
    } catch (error) {
        showNotification('Failed to update secure records', 'error');
    }
  };

  const handleStatusChange = async (userId: string, active: boolean) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const updatedUser = { ...user, active };
    setUsers(currentUsers => currentUsers.map(u => u.id === userId ? updatedUser : u));
    await updateUserInDB(updatedUser);
    showNotification(`Operator status: ${active ? 'ACTIVE' : 'INACTIVE'}`);
  };

  const filteredUsers = useMemo(() => {
      return users.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.phone.includes(searchTerm) ||
        u.role.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [users, searchTerm]);

  const selectStyles = "appearance-none bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-[11px] font-black uppercase tracking-widest outline-none pr-10 w-full cursor-pointer hover:bg-slate-50 transition-all focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 shadow-sm text-slate-600";
  const inputStyles = "w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold uppercase outline-none focus:bg-white focus:border-indigo-500 transition-all placeholder-slate-300 shadow-inner";
  const labelStyles = "block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2.5";

  return (
    <div className="flex flex-col space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-5 w-full xl:w-auto">
            <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-200 shrink-0">
                <UserCog size={28} strokeWidth={2.5} />
            </div>
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">Team Registry</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Managing Isolated Node Personnel</p>
            </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto justify-end">
            <div className="flex items-center gap-4 bg-white border border-slate-200 px-8 py-3.5 rounded-[2rem] shadow-sm">
                <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                    <Users size={16} />
                </div>
                <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Personnel</p>
                    <p className="text-xl font-black text-slate-800 tracking-tighter leading-none">{users.length}</p>
                </div>
            </div>
            <div className="w-px h-8 bg-slate-200 mx-2 hidden sm:block"></div>
            <button 
                onClick={handleRefresh}
                className="p-4 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-indigo-600 shadow-sm transition-all active:rotate-180 duration-700"
            >
                <RefreshCw size={20} strokeWidth={2.5} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <button 
                onClick={openAddModal}
                className="flex-1 lg:flex-none flex items-center justify-center px-10 py-4 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:shadow-indigo-300 transition-all active:scale-95"
            >
                <Plus size={16} className="mr-2" strokeWidth={4} /> Register Operator
            </button>
        </div>
      </div>

      {/* Search Hub */}
      <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-4 items-center no-print">
        <div className="relative flex-1 group w-full">
            <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
                type="text" 
                placeholder="Search by identity or role..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-14 pr-8 py-4 bg-slate-50/50 border border-slate-200 rounded-[2rem] text-[13px] font-bold uppercase outline-none focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner" 
            />
        </div>
        <div className="flex items-center gap-4 bg-slate-50/50 px-6 py-4 rounded-[2rem] border border-slate-100 shrink-0">
            <Activity size={16} className="text-emerald-500" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Status Filter Enabled</span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left table-fixed min-w-[1000px]">
                <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                        <th className="w-[30%] px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Personnel Identity</th>
                        <th className="w-[20%] px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact</th>
                        <th className="w-[15%] px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Clearance</th>
                        <th className="w-[15%] px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                        <th className="w-[20%] px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {loading ? (
                        <tr><td colSpan={5} className="py-40 text-center"><Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} /><p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mt-4">Syncing Node Personnel...</p></td></tr>
                    ) : filteredUsers.length === 0 ? (
                        <tr><td colSpan={5} className="py-40 text-center"><Users size={48} className="text-slate-100 mx-auto mb-4" /><p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">No personnel matching search</p></td></tr>
                    ) : filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/50 transition-all group">
                            <td className="px-10 py-6">
                                <div className="flex items-center gap-5">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs shadow-inner shrink-0 group-hover:scale-110 transition-transform ${user.role === 'Super Admin' ? 'bg-slate-900 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                                        {user.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[15px] font-black text-slate-800 uppercase tracking-tight truncate leading-none mb-1.5">{user.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {user.id.slice(-6).toUpperCase()}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-10 py-6">
                                <div className="flex items-center gap-2 text-slate-600 font-bold text-[13px]">
                                    <Phone size={14} className="text-slate-300" />
                                    {user.phone}
                                </div>
                            </td>
                            <td className="px-10 py-6 text-center">
                                <span className={`inline-flex px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                                    user.role === 'Super Admin' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                }`}>
                                    {user.role}
                                </span>
                            </td>
                            <td className="px-10 py-6 text-center">
                                <button 
                                    onClick={() => handleStatusChange(user.id, !user.active)}
                                    className={`inline-flex px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                                        user.active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                                    }`}
                                >
                                    {user.active ? 'Active' : 'Revoked'}
                                </button>
                            </td>
                            <td className="px-10 py-6 text-right">
                                <div className="flex items-center justify-end gap-2.5">
                                    <button 
                                        onClick={() => openEditModal(user)}
                                        className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl transition-all shadow-sm active:scale-90"
                                        title="Modify Access"
                                    >
                                        <Edit2 size={18} strokeWidth={3} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* REGISTER / EDIT MODAL */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-100 animate-in zoom-in-95">
                  <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shrink-0">
                              {editingUser ? <Shield size={28} /> : <UserPlus size={28} />}
                          </div>
                          <div>
                              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">
                                  {editingUser ? 'Access Profile Update' : 'New Personnel Enlistment'}
                              </h3>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Operator Security Protocol</p>
                          </div>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all hover:rotate-90 shadow-sm">
                          <X size={24} />
                      </button>
                  </div>
                  
                  <div className="p-10 bg-white">
                    <form onSubmit={(e) => { e.preventDefault(); handleSaveUser(); }} className="space-y-12">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            {/* IDENTITY SECTION */}
                            <div className="space-y-8">
                                <div className="flex items-center gap-3 mb-2">
                                    <ShieldAlert size={18} className="text-indigo-500" />
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Primary identity</h4>
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className={labelStyles}>Full legal Name</label>
                                        <div className="relative">
                                            <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputStyles} placeholder="ENTER FULL NAME..." />
                                            {/* Changed User icon to UserIcon to fix naming conflict */}
                                            <UserIcon size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className={labelStyles}>Terminal Mobile ID</label>
                                        <div className="relative">
                                            <input required type="tel" maxLength={10} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} className={inputStyles} placeholder="0000000000" />
                                            <Smartphone size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className={labelStyles}>Deployment Hub / City</label>
                                        <div className="relative">
                                            <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className={inputStyles} placeholder="e.g. MUMBAI NODE..." />
                                            <MapPin size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* CLEARANCE SECTION */}
                            <div className="space-y-8 bg-slate-50/50 p-10 rounded-[3rem] border border-slate-100">
                                <div className="flex items-center gap-3 mb-2">
                                    <KeyRound size={18} className="text-indigo-500" />
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Security Credentials</h4>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2 relative">
                                        <label className={labelStyles}>Clearance Role</label>
                                        <div className="relative">
                                            <select 
                                                value={formData.role} 
                                                onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                                                className={selectStyles}
                                            >
                                                {ROLES.map(role => (
                                                    <option key={role} value={role}>{role}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className={labelStyles}>Secure PIN Access</label>
                                        <div className="relative">
                                            <input required type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className={inputStyles} placeholder="••••" />
                                            <LockIcon size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 pt-4">
                                        <div className="flex-1 space-y-2">
                                            <label className={labelStyles}>Node Status</label>
                                            <div className="flex p-1 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                                <button type="button" onClick={() => setFormData({...formData, active: true})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>Enabled</button>
                                                <button type="button" onClick={() => setFormData({...formData, active: false})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!formData.active ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400'}`}>Locked</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-6">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-10 py-4 rounded-2xl bg-slate-50 text-slate-400 font-black text-[11px] uppercase tracking-[0.2em] shadow-sm hover:bg-slate-100 transition-all active:scale-95">Discard Changes</button>
                            <button type="submit" className="flex-1 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-[13px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-3">
                                <ShieldCheck size={20} />
                                {editingUser ? 'Update Secure Node' : 'Initialize Node Enlistment'}
                            </button>
                        </div>
                    </form>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default UserManagement;
