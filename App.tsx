
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import Filters from './components/Filters';
import OrderTable from './components/OrderTable';
import OrderDetail from './components/OrderDetail';
import FinancialInvoice from './components/FinancialInvoice';
import Inventory from './components/Inventory';
import UserManagement from './components/UserManagement';
import MasterControl from './components/MasterControl';
import Customers from './components/Customers';
import CustomerFirms from './components/CustomerFirms';
import CustomerGR from './components/CustomerGR';
import LinksManager from './components/LinksManager';
import BroadcastGroups from './components/BroadcastGroups';
import ShopModelList from './components/ShopModelList';
import ModelHistoryDetail from './components/ModelHistoryDetail';
import OrderReports from './components/OrderReports';
import CustomerOrderReports from './components/CustomerOrderReports';
import DailyFulfilledSummary from './components/DailyFulfilledSummary';
import CreateOrder from './components/CreateOrder';
import Login from './components/Login';
import CustomerPortal from './components/CustomerPortal';
import { RefreshCw, Loader2 } from 'lucide-react';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import { Order, User, OrderStatus, InventoryItem, Customer, OrderItem, InventoryLog } from './types';
import { 
    fetchOrders, 
    updateOrderInDB, 
    addOrderToDB, 
    fetchCustomers, 
    updateCustomerInDB,
    fetchInventory,
    updateInventoryItemInDB,
    addInventoryLogToDB,
    deleteInventoryLogFromDB,
    fetchLinks,
    updateLinkInDB,
    fetchUsers,
    listenToOrders,
    sendCloudPing,
    fetchMasterRecords
} from './services/db';

const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentView, setCurrentView] = useState('orders'); 
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedModel, setSelectedModel] = useState<any | null>(null);
  const [orderingCustomer, setOrderingCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]); 
  const [searchTerm, setSearchTerm] = useState('');
  const { showNotification } = useNotification();
  
  // External Portal State
  const [portalCode, setPortalCode] = useState<string | null>(null);
  const [activePortalLink, setActivePortalLink] = useState<any | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allInventory, setAllInventory] = useState<InventoryItem[]>([]);
  const [availableWarehouses, setAvailableWarehouses] = useState<string[]>([]);

  const [showAllTransactions, setShowAllTransactions] = useState(false);
  
  // Default Filter States - Set to 'LAST 3 DAY'
  const [dateFilter, setDateFilter] = useState('LAST 3 DAY');
  const [statusFilter, setStatusFilter] = useState('ALL STATUS');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [isDashboardRefreshing, setIsDashboardRefreshing] = useState(false);

  // Sorting State - Default Newest First (Time based)
  const [sortConfig, setSortConfig] = useState<{ key: keyof Order | null, direction: 'asc' | 'desc' | null }>({
    key: 'orderTime',
    direction: 'desc' 
  });
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    // Check for External Portal Code in URL before anything else
    const params = new URLSearchParams(window.location.search);
    const code = params.get('portal');
    
    const initializeApp = async () => {
        if (code) {
            setPortalCode(code);
            await loadPortalData(code);
        }

        const storedUser = localStorage.getItem('apexflow_auth_user');
        if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            setCurrentUser(user);
          } catch (e) {
            localStorage.removeItem('apexflow_auth_user');
          }
        }
        setIsAuthChecking(false);
    };

    initializeApp();
  }, []);

  const loadPortalData = async (code: string) => {
      setPortalLoading(true);
      try {
          const [links, custs, inv] = await Promise.all([
              fetchLinks(),
              fetchCustomers(),
              fetchInventory()
          ]);
          const link = links.find((l: any) => l.code === code);
          if (link) {
              setActivePortalLink(link);
              setAllCustomers(custs);
              setAllInventory(inv);
          } else {
              showNotification('Portal Link is invalid or has been disabled.', 'error');
              setPortalCode(null);
          }
      } catch (e) {
          console.error("Portal data load failed", e);
          showNotification('Connectivity error while loading portal.', 'error');
      } finally {
          setPortalLoading(false);
      }
  };

  useEffect(() => {
    if (currentUser) {
        loadBaseData();
        const unsubscribe = listenToOrders(currentUser.instanceId, (liveOrders) => {
            setOrders(liveOrders);
        });
        return () => unsubscribe();
    }
  }, [currentUser]);

  const loadBaseData = async () => {
    const [usersData, warehousesData, inventoryData, customersData] = await Promise.all([
      fetchUsers(currentUser?.instanceId),
      fetchMasterRecords('warehouse'),
      fetchInventory(currentUser?.instanceId),
      fetchCustomers(currentUser?.instanceId)
    ]);
    setUsers(usersData);
    setAvailableWarehouses(warehousesData);
    setAllInventory(inventoryData);
    setAllCustomers(customersData);
  };

  // Global Refresh handles everything (Filters, Status, Search, Sorting)
  const handleRefreshDashboard = async () => {
    setIsDashboardRefreshing(true);
    // Reset all UI states to default
    setSearchTerm('');
    setDateFilter('LAST 3 DAY');
    setStatusFilter('ALL STATUS');
    setModeFilter('ALL');
    setWarehouseFilter('ALL');
    setSortConfig({ key: 'orderTime', direction: 'desc' });
    
    // Re-fetch necessary data
    await loadBaseData();
    
    setTimeout(() => {
        setIsDashboardRefreshing(false);
        showNotification('Dashboard Refresh & Reset Complete');
    }, 600);
  };

  const handleViewChange = (viewId: string) => {
    setSelectedOrder(null);
    setSelectedModel(null);
    setOrderingCustomer(null);
    setCurrentView(viewId);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    const view = user.role === 'GR' ? 'customer_gr' : 'orders';
    handleViewChange(view);
    localStorage.setItem('apexflow_auth_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('apexflow_auth_user');
    showNotification('Session terminated');
  };

  // Precise parsing of date/time string for accurate sorting
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

  // Helper to check date range logic
  const isDateInRange = (orderDateStr: string, filter: string) => {
    if (filter === 'ALL') return true;
    const orderTime = parseOrderDate(orderDateStr);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    switch (filter) {
        case 'TODAY':
            return orderTime >= todayStart;
        case 'LAST 3 DAY':
            return orderTime >= todayStart - (3 * 24 * 60 * 60 * 1000);
        case 'LAST 7 DAY':
            return orderTime >= todayStart - (7 * 24 * 60 * 60 * 1000);
        case 'CURRENT MONTH':
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            return orderTime >= monthStart;
        case 'LAST MONTH':
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).getTime();
            return lastMonthStart <= orderTime && orderTime <= lastMonthEnd;
        default:
            return true;
    }
  };

  // Helper to remove out-of-stock items from portals
  const syncPortalVisibilityOnStockEmpty = async (itemId: string, newQty: number) => {
      if (newQty <= 0) {
          try {
              const allLinks = await fetchLinks(currentUser?.instanceId);
              const updatePromises = allLinks.map(link => {
                  const currentAllowed = link.allowedModels || [];
                  const nextAllowed = currentAllowed.filter((id: string) => id !== itemId);
                  if (nextAllowed.length !== currentAllowed.length) {
                      return updateLinkInDB({ ...link, allowedModels: nextAllowed });
                  }
                  return null;
              }).filter(p => p !== null);
              if (updatePromises.length > 0) await Promise.all(updatePromises);
          } catch (e) {
              console.error("Portal visibility sync failed", e);
          }
      }
  };

  // STEP 1: Global filtering (Date, Mode, Warehouse, Search)
  const baseFilteredOrders = useMemo(() => {
    return orders.filter(o => {
      // 1. Workflow Restrictions for Staff Roles
      if (currentUser) {
          if (currentUser.role === 'Picker') {
              // Picker only sees orders specifically assigned to them
              return o.status === 'assigned' && o.assignedToId === currentUser.id;
          }
          if (currentUser.role === 'Checker') {
              // Checker only sees orders that are marked as Packed (by Picker)
              return o.status === 'packed';
          }
          if (currentUser.role === 'Dispatcher') {
              // Dispatcher only sees orders that are checked
              return o.status === 'checked';
          }
      }

      // 2. Transaction Toggle logic
      if (!showAllTransactions) {
          if (o.status === 'Payment' || o.status === 'Return') return false;
      }
      
      // 3. Search logic (ID or Customer Name)
      const matchesSearch = (o.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (o.id || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // 4. Warehouse logic
      if (warehouseFilter !== 'ALL') {
          if (o.warehouse !== warehouseFilter) return false;
      }

      // 5. Mode logic
      if (modeFilter !== 'ALL') {
          if ((o.orderMode || '').toUpperCase() !== modeFilter) return false;
      }

      // 6. Date Range logic
      if (!isDateInRange(o.orderTime, dateFilter)) return false;

      return true;
    });
  }, [orders, searchTerm, showAllTransactions, dateFilter, modeFilter, warehouseFilter, currentUser]);

  // STEP 2: Apply the specific status filter (from StatsCards or Dropdown)
  const finalFilteredOrders = useMemo(() => {
    const isStaff = currentUser && ['Picker', 'Checker', 'Dispatcher'].includes(currentUser.role);

    let result = baseFilteredOrders.filter(o => {
        // Finance entries bypass status filters if ledger is active
        if (o.status === 'Payment' || o.status === 'Return') return true;
        
        // Staff don't get secondary status filtering - they only see what the workflow allows
        if (isStaff) return true;

        if (statusFilter === 'ALL STATUS') return o.status !== 'rejected';
        if (statusFilter === 'PENDING') return o.invoiceStatus === 'Pending' && o.status !== 'rejected';
        
        return (o.status || '').toUpperCase() === statusFilter;
    });

    // 3. Precise Time-Value Sorting
    const activeSortKey = sortConfig.key || 'orderTime';
    const activeSortDir = sortConfig.direction || 'desc';
    
    return result.sort((a, b) => {
        let valA: any = a[activeSortKey];
        let valB: any = b[activeSortKey];
        
        if (activeSortKey === 'orderTime') {
            valA = parseOrderDate(a.orderTime);
            valB = parseOrderDate(b.orderTime);
        }
        
        if (valA < valB) return activeSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return activeSortDir === 'asc' ? 1 : -1;
        return 0;
    });
  }, [baseFilteredOrders, statusFilter, sortConfig, currentUser]);

  const renderView = () => {
    if (orderingCustomer) return <CreateOrder customer={orderingCustomer} onBack={() => setOrderingCustomer(null)} onSubmitOrder={async (o, items) => { await addOrderToDB({...o, items, instanceId: currentUser?.instanceId}); setOrderingCustomer(null); handleViewChange('orders'); }} />;
    if (selectedOrder) {
        if (selectedOrder.status === 'Payment' || selectedOrder.status === 'Return') return <FinancialInvoice order={selectedOrder} onClose={() => setSelectedOrder(null)} />;
        return <OrderDetail 
          order={selectedOrder} 
          onBack={() => setSelectedOrder(null)} 
          currentUser={currentUser!} 
          allUsers={users} 
          onUpdateStatus={async (id, status, pId, pName, explicitItems) => {
            // CRITICAL: Fetch absolute latest data from orders list
            const existingOrder = orders.find(o => o.id === id) || selectedOrder;
            if (!existingOrder) return;

            // Use passed items if available, otherwise fallback to existingOrder items
            const orderItemsForLogic = explicitItems || existingOrder.items || [];
            const currentTotal = orderItemsForLogic.reduce((sum, item) => sum + (item.fulfillQty * item.finalPrice), 0);
            
            let billedAmount = existingOrder.billedAmount || 0;
            const isBillingStatus = status === 'checked' || status === 'dispatched';
            const wasNotBillingStatus = existingOrder.status !== 'checked' && existingOrder.status !== 'dispatched';

            // REJECTED LOGIC: Revert customer balance AND return stock AND remove history
            if (status === 'rejected') {
                if (existingOrder.billedAmount && existingOrder.billedAmount > 0) {
                    try {
                        // 1. Revert Customer Balance
                        const allCusts = await fetchCustomers(currentUser?.instanceId);
                        const cust = allCusts.find(c => 
                            (existingOrder.customerId && c.id === existingOrder.customerId) || 
                            (!existingOrder.customerId && c.name === existingOrder.customerName && (c.city === existingOrder.customerSubtext || c.address === existingOrder.customerSubtext))
                        );
                        if (cust) {
                            const newBalance = Number(cust.balance) + Number(existingOrder.billedAmount);
                            await updateCustomerInDB({ ...cust, balance: newBalance });
                        }

                        // 2. Revert Inventory Stock & Remove History
                        const currentInventory = await fetchInventory(currentUser?.instanceId);
                        for (const orderItem of orderItemsForLogic) {
                            if (orderItem.fulfillQty <= 0) continue;

                            const invItem = currentInventory.find(i => 
                                i.brand.toUpperCase().trim() === orderItem.brand.toUpperCase().trim() && 
                                i.model.toUpperCase().trim() === orderItem.model.toUpperCase().trim() &&
                                i.quality.toUpperCase().trim() === orderItem.quality.toUpperCase().trim()
                            );

                            if (invItem) {
                                // Return Stock
                                const newQty = invItem.quantity + orderItem.fulfillQty;
                                await updateInventoryItemInDB({ ...invItem, quantity: newQty });
                                
                                // REMOVE HISTORY: Delete the specific sale log associated with this order/item pair
                                const saleLogId = `sale-${existingOrder.id}-${invItem.id}`;
                                await deleteInventoryLogFromDB(saleLogId);
                            }
                        }
                        showNotification(`Order rejected: Credit and stock restored, history removed.`, 'info');
                    } catch (e) {
                        console.error("Reversal failed", e);
                    }
                }
                billedAmount = 0; 
            }
            // BILLING LOGIC: Deduct credit & stock & create history when reaching billed status for first time
            else if (isBillingStatus && wasNotBillingStatus) {
                // 1. Balance Deduction
                try {
                    const allCusts = await fetchCustomers(currentUser?.instanceId);
                    const cust = allCusts.find(c => 
                        (existingOrder.customerId && c.id === existingOrder.customerId) || 
                        (!existingOrder.customerId && c.name === existingOrder.customerName && (c.city === existingOrder.customerSubtext || c.address === existingOrder.customerSubtext))
                    );
                    if (cust) {
                        const newBalance = Number(cust.balance) - currentTotal;
                        await updateCustomerInDB({ ...cust, balance: newBalance });
                        billedAmount = currentTotal;
                        showNotification(`₹${currentTotal.toFixed(1)} deducted from balance`, 'success');
                    }
                } catch (e) {
                    console.error("Balance deduction failed", e);
                }

                // 2. Inventory Deduction & Create Sale History
                try {
                    const currentInventory = await fetchInventory(currentUser?.instanceId);
                    const now = new Date();
                    const timestamp = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

                    for (const orderItem of orderItemsForLogic) {
                        if (orderItem.fulfillQty <= 0) continue;

                        const invItem = currentInventory.find(i => 
                            i.brand.toUpperCase().trim() === orderItem.brand.toUpperCase().trim() && 
                            i.model.toUpperCase().trim() === orderItem.model.toUpperCase().trim() &&
                            i.quality.toUpperCase().trim() === orderItem.quality.toUpperCase().trim()
                        );

                        if (invItem) {
                            const newQty = invItem.quantity - orderItem.fulfillQty;
                            await updateInventoryItemInDB({ ...invItem, quantity: newQty });
                            await syncPortalVisibilityOnStockEmpty(invItem.id, newQty);
                            
                            // CREATE PREDICTABLE HISTORY LOG ID
                            const saleLogId = `sale-${existingOrder.id}-${invItem.id}`;
                            const log: InventoryLog = {
                                id: saleLogId,
                                itemId: invItem.id,
                                modelName: `${invItem.brand} ${invItem.model} ${invItem.quality}`,
                                shopName: existingOrder.customerName,
                                status: 'Removed',
                                quantityChange: orderItem.fulfillQty,
                                totalQuantity: orderItem.fulfillQty,
                                itemCount: 1,
                                currentStock: newQty,
                                remarks: `Automatic Deduction (Status: ${status.toUpperCase()} on Order #${existingOrder.id})`,
                                createdDate: timestamp,
                                customerName: existingOrder.customerName,
                                instanceId: currentUser?.instanceId
                            };
                            await addInventoryLogToDB(log);
                        }
                    }
                } catch (e) {
                    console.error("Inventory deduction failed", e);
                }
            }

            const updated = { 
              ...existingOrder, 
              status, 
              assignedToId: pId !== undefined ? pId : existingOrder.assignedToId, 
              assignedTo: pName !== undefined ? pName : existingOrder.assignedTo,
              billedAmount,
              totalAmount: isBillingStatus ? currentTotal : existingOrder.totalAmount,
              items: orderItemsForLogic
            };
            
            try {
              await updateOrderInDB(updated);
              showNotification(`Status: ${status.toUpperCase()}`);
              if (selectedOrder && selectedOrder.id === id) {
                setSelectedOrder(updated);
              }
            } catch (error) {
              showNotification('Database sync failed', 'error');
            }
        }} />;
    }
    if (selectedModel) return <ModelHistoryDetail model={selectedModel} onBack={() => setSelectedModel(null)} />;

    switch (currentView) {
      case 'inventory': return <Inventory currentUser={currentUser!} />;
      case 'models': return <ShopModelList onViewModel={setSelectedModel} />;
      case 'clients': return <Customers onCreateOrder={setOrderingCustomer} currentUser={currentUser!} />;
      case 'customer_firms': return <CustomerFirms />;
      case 'customer_gr': return <CustomerGR currentUser={currentUser!} />;
      case 'users': return <UserManagement currentUser={currentUser!} />;
      case 'master_control': return <MasterControl />;
      case 'links': return <LinksManager currentUser={currentUser!} />;
      case 'broadcast': return <BroadcastGroups />;
      case 'order_reports': return <OrderReports />;
      case 'customer_order_report': return <CustomerOrderReports />;
      case 'order_summary': return <DailyFulfilledSummary />;
      default:
        const isStaff = currentUser && ['Picker', 'Checker', 'Dispatcher'].includes(currentUser.role);
        return (
          <>
            {!isStaff && (
              <StatsCards orders={baseFilteredOrders} activeFilter={statusFilter} onStatusClick={setStatusFilter} />
            )}
            <Filters 
                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                dateFilter={dateFilter} setDateFilter={setDateFilter}
                statusFilter={statusFilter} setStatusFilter={setStatusFilter}
                modeFilter={modeFilter} setModeFilter={setModeFilter}
                warehouseFilter={warehouseFilter} setWarehouseFilter={setWarehouseFilter}
                onRefresh={handleRefreshDashboard} isRefreshing={isDashboardRefreshing}
                isStaffView={isStaff}
                availableWarehouses={availableWarehouses}
            />
            <OrderTable 
              orders={finalFilteredOrders} 
              onViewOrder={setSelectedOrder} 
              userRole={currentUser?.role} 
              onSort={(key) => setSortConfig({ key, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
              sortConfig={sortConfig}
            />
          </>
        );
    }
  };

  if (isAuthChecking) return <div className="h-screen w-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48}/></div>;

  if (portalCode) {
      if (portalLoading) {
          return (
              <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
                  <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
                  <p className="text-white font-black uppercase tracking-[0.3em] text-[10px]">Verifying Digital Node...</p>
              </div>
          );
      }
      if (activePortalLink) {
          const allowedInventory = allInventory.filter(i => (activePortalLink.allowedModels || []).includes(i.id));
          const portalWarehouse = activePortalLink.warehouse || activePortalLink.title || 'Main Warehouse';
          return (
              <CustomerPortal 
                  storeName={activePortalLink.title}
                  status={activePortalLink.status}
                  inventory={allowedInventory}
                  allCustomers={allCustomers}
                  isExternal={true}
                  instanceId={activePortalLink.instanceId} 
                  warehouse={portalWarehouse}
              />
          );
      }
  }

  if (!currentUser) return <Login onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex relative">
      <Sidebar currentView={currentView} onChangeView={handleViewChange} userRole={currentUser.role} userId={currentUser.id} isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} isMobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
      <div className="flex-1 transition-all duration-300 min-w-0">
        <main className="px-4 md:px-10 pb-10 max-w-[1600px] mx-auto min-h-screen">
          <Header currentUser={currentUser} title={currentView} onMenuClick={() => setMobileSidebarOpen(true)} showAllTransactions={showAllTransactions} onToggleAllTransactions={() => setShowAllTransactions(!showAllTransactions)} onLogout={handleLogout} />
          <div className="pt-0 md:pt-2">{renderView()}</div>
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <NotificationProvider><AppContent /></NotificationProvider>
);

export default App;
