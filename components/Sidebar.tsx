
import React, { useMemo, useEffect, useState } from 'react';
import { 
  Layers, ChevronDown, LayoutDashboard, X, ShieldAlert
} from 'lucide-react';
import { SIDEBAR_ITEMS } from '../constants';
import { UserRole, SidebarItem, RolePermissions } from '../types';
import { fetchRolePermissions } from '../services/db';

interface SidebarProps {
  currentView: string;
  onChangeView: (viewId: string) => void;
  userRole?: UserRole;
  userId?: string; 
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    currentView, 
    onChangeView, 
    userRole = 'Picker', 
    userId,
    isCollapsed, 
    onToggleCollapse, 
    isMobileOpen, 
    onMobileClose 
}) => {
  const [permissions, setPermissions] = useState<RolePermissions[]>([]);

  useEffect(() => {
    fetchRolePermissions().then(setPermissions);
  }, []);

  // Logic to filter sidebar based on dynamic permissions configuration
  const filteredNavItems = useMemo(() => {
    return SIDEBAR_ITEMS.filter(item => {
        // MASTER ARCHITECT (root-master) - FULL ACCESS for recovery
        if (userId === 'root-master') {
            return true; 
        }

        // Look up permissions for the current user's role
        const rolePerms = permissions.find(p => p.role === userRole);
        if (rolePerms) {
            return rolePerms.allowedModules.includes(item.id);
        }

        // Fallback for initialization
        return userRole === 'Super Admin' || ['orders'].includes(item.id);
    }).map(item => {
        // Special case: Rename "Orders" to "Root Console" for Master Architect
        if (userId === 'root-master' && item.id === 'orders') {
            return { ...item, label: 'Root Console', icon: <ShieldAlert size={18} /> };
        }

        // Filter subitems based on role and identity
        if (item.subItems) {
            const allowedSubItems = item.subItems.filter(sub => {
                // SECURITY: Never show Master Control to non-root accounts, even Super Admins
                if (sub.id === 'master_control' && userId !== 'root-master') {
                    return false;
                }
                
                // Specific role logic
                if (userRole !== 'Super Admin') {
                    if (userRole === 'GR') {
                        return sub.id === 'customer_gr';
                    }
                }
                return true;
            });
            return { ...item, subItems: allowedSubItems };
        }
        return item;
    });
  }, [userRole, userId, permissions]);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] md:hidden animate-in fade-in duration-300"
          onClick={onMobileClose}
        />
      )}

      <aside className={`
        transition-all duration-300 bg-white border-r border-slate-200 flex flex-col shrink-0
        ${isMobileOpen 
          ? 'fixed left-0 top-0 h-screen z-[70] translate-x-0 w-[260px]' 
          : 'relative hidden md:flex h-screen sticky top-0'}
        ${isCollapsed && !isMobileOpen ? 'md:w-[80px]' : 'md:w-[260px]'}
      `}>
        
        {/* Brand Identity - Rebranded to ApexFlow */}
        <div 
          onClick={onToggleCollapse}
          className="h-[70px] px-5 flex items-center justify-between border-b border-slate-50 relative shrink-0 cursor-pointer hover:bg-slate-50/50 transition-colors group"
        >
          <div className={`flex items-center gap-3 transition-all duration-300 ${(isCollapsed && !isMobileOpen) ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}>
            {(!isCollapsed || isMobileOpen) && (
              <>
                <div className="w-10 h-10 bg-[#4f46e5] rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 shrink-0 group-hover:scale-105 transition-transform">
                  <Layers size={22} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-lg tracking-tighter text-slate-800 leading-none">ApexFlow</span>
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1">Management Hub</span>
                </div>
              </>
            )}
          </div>

          {isCollapsed && !isMobileOpen && (
              <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 bg-[#4f46e5] rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                      <Layers size={22} strokeWidth={2.5} />
                  </div>
              </div>
          )}

          {isMobileOpen && (
            <button 
              onClick={(e) => { e.stopPropagation(); onMobileClose(); }}
              className="md:hidden p-2 text-slate-400 hover:text-rose-500 transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="flex-1 py-6 overflow-y-auto custom-scrollbar overflow-x-hidden">
          {(!isCollapsed || isMobileOpen) && (
            <p className="px-7 mb-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] transition-opacity">
              {userId === 'root-master' ? 'Architect' : userRole.split(' ')[0]} Workstation
            </p>
          )}
          
          <nav className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = currentView === item.id || (item.subItems?.some(s => s.id === currentView));
              return (
                <div key={item.id} className="relative">
                  <button 
                    onClick={() => {
                        if (userRole === 'GR' && item.id === 'clients') {
                            onChangeView('customer_gr');
                        } else if (item.id === 'reports') {
                            // Automatically open the first report type when clicking the main Reports icon
                            onChangeView('order_reports');
                        } else {
                            onChangeView(item.id);
                        }
                        if (!item.subItems) onMobileClose();
                    }}
                    className={`w-full flex items-center transition-all duration-300 px-7 py-3 text-sm font-semibold ${
                      isActive 
                        ? 'sidebar-active' 
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    } ${(isCollapsed && !isMobileOpen) ? 'justify-center px-0' : 'justify-between'}`}
                    title={(isCollapsed && !isMobileOpen && !item.subItems) ? item.label : undefined}
                  >
                    <div className="flex items-center gap-3.5">
                      <span className={`${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {React.cloneElement(item.icon as React.ReactElement<any>, { size: 20, strokeWidth: isActive ? 2.5 : 2 })}
                      </span>
                      {(!isCollapsed || isMobileOpen) && <span>{item.label}</span>}
                    </div>
                    {(!isCollapsed || isMobileOpen) && item.subItems && (
                      <ChevronDown size={14} className={`transition-transform duration-300 ${isActive ? '' : '-rotate-90 opacity-40'}`} />
                    )}
                  </button>
                  
                  {isActive && item.subItems && (!isCollapsed || isMobileOpen) && (
                    <div className="bg-slate-50/50 py-2 animate-in slide-in-from-top-1 duration-200">
                      {item.subItems.map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => {
                              onChangeView(sub.id);
                              onMobileClose();
                          }}
                          className={`w-full text-left pl-14 pr-4 py-2 text-xs font-bold transition-colors ${
                            currentView === sub.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {sub.label.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-50 shrink-0">
          <div className={`bg-slate-50 rounded-2xl p-3 flex items-center transition-all duration-300 ${(isCollapsed && !isMobileOpen) ? 'justify-center' : 'gap-3'}`}>
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <LayoutDashboard size={16} />
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex-1 min-w-0 transition-opacity">
                  <p className="text-[10px] font-black text-slate-800 uppercase truncate">Secure V2.4</p>
                  <p className="text-[9px] font-bold text-slate-400">Node Active</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
