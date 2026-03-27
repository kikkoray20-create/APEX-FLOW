import { 
    collection, 
    getDocs, 
    doc, 
    deleteDoc, 
    query, 
    where, 
    setDoc,
    orderBy,
    onSnapshot,
    serverTimestamp,
    limit,
    getDoc
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User, Order, Customer, Firm, InventoryItem, InventoryLog, GRInventoryItem, RolePermissions, PingNotification } from '../types';
import { MOCK_USERS, MOCK_CUSTOMERS, MOCK_INVENTORY } from '../constants';

const KEYS = {
    users: 'users',
    orders: 'orders',
    customers: 'customers', 
    firms: 'firms',
    inventory: 'inventory',
    inventory_logs: 'inventory_logs',
    links: 'links',
    groups: 'groups',
    role_permissions: 'role_permissions',
    pings: 'pings'
};

// Universal fetcher with Cloud Priority & Intelligent Merging
const getData = async (collectionName: string, localKey: string, fallbackData: any[] = [], instanceId?: string) => {
    const localStoreKey = `apexflow_local_${localKey}`;
    
    if (db) {
        try {
            const collectionRef = collection(db, collectionName);
            const q = instanceId 
                ? query(collectionRef, where("instanceId", "==", instanceId))
                : collectionRef;
                
            const querySnapshot = await getDocs(q);
            const cloudData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            
            const local = localStorage.getItem(localStoreKey);
            let localData: any[] = [];
            try {
                localData = local ? JSON.parse(local) : [];
                if (!Array.isArray(localData)) localData = [];
            } catch (e) {
                localData = [];
            }

            // Merge logic: Cloud data is authoritative, but keep local items that haven't synced
            const merged = [...cloudData];
            localData.forEach((lItem: any) => {
                if (lItem && lItem.id && !merged.find(cItem => cItem.id === lItem.id)) {
                    // Only merge local items that match the requested instanceId (if provided)
                    if (!instanceId || lItem.instanceId === instanceId) {
                        merged.push(lItem);
                    }
                }
            });

            // Sync local with merged for offline reliability
            localStorage.setItem(localStoreKey, JSON.stringify(merged));
            return merged;
        } catch (e) {
            console.warn(`🛰️ Cloud fetch failed for [${collectionName}], using local cache. Error:`, e);
        }
    }

    const local = localStorage.getItem(localStoreKey);
    let parsed: any[] = [];
    
    try {
        parsed = local ? JSON.parse(local) : [];
        if (!Array.isArray(parsed)) parsed = [];
    } catch (error) {
        console.error("Local storage parse error for " + localStoreKey, error);
        parsed = [];
    }
    
    if (parsed.length === 0 && fallbackData.length > 0) {
        parsed = fallbackData;
        localStorage.setItem(localStoreKey, JSON.stringify(parsed));
    }

    return instanceId 
        ? parsed.filter((item: any) => item && (!item.instanceId || item.instanceId === instanceId))
        : parsed;
};

// Universal saver with Cloud Sync
const saveData = async (collectionName: string, localKey: string, data: any, isUpdate = false) => {
    const localStoreKey = `apexflow_local_${localKey}`;
    
    const docRef = data.id ? doc(db, collectionName, data.id) : doc(collection(db, collectionName));
    const docId = docRef.id;
    const finalData = { ...data, id: docId, updatedAt: new Date().toISOString() };
    
    if (db) {
        try {
            await setDoc(docRef, finalData, { merge: true });
        } catch (e) {
            console.error("❌ Cloud sync failed:", e);
        }
    }
    
    // Always update the data object with the generated ID and timestamp for local storage
    const dataToStore = finalData;
    const localStr = localStorage.getItem(localStoreKey);
    let localData: any[] = [];
    try {
        localData = localStr ? JSON.parse(localStr) : [];
        if (!Array.isArray(localData)) localData = [];
    } catch (e) {
        localData = [];
    }
    
    if (isUpdate) {
        localData = localData.map((item: any) => item && item.id === dataToStore.id ? dataToStore : item);
    } else {
        const exists = localData.find((item: any) => item && item.id === dataToStore.id);
        if (!exists) localData = [dataToStore, ...localData];
    }
    localStorage.setItem(localStoreKey, JSON.stringify(localData));
    return dataToStore;
};

const removeData = async (collectionName: string, localKey: string, id: string) => {
    const localStoreKey = `apexflow_local_${localKey}`;
    
    if (db) {
        try {
            await deleteDoc(doc(db, collectionName, id));
        } catch (e) {
            console.error("❌ Cloud delete failed:", e);
        }
    }

    const localStr = localStorage.getItem(localStoreKey);
    if (localStr) {
        try {
            const localData = JSON.parse(localStr);
            if (Array.isArray(localData)) {
                localStorage.setItem(localStoreKey, JSON.stringify(localData.filter((item: any) => item && item.id !== id)));
            }
        } catch (e) {}
    }
};

// --- REAL-TIME LISTENERS ---
export const listenToOrders = (instanceId: string | undefined, callback: (orders: Order[]) => void): (() => void) => {
    if (!db) {
        callback([]);
        return () => {};
    }

    const ordersRef = collection(db, KEYS.orders);
    const q = instanceId 
        ? query(ordersRef, where("instanceId", "==", instanceId))
        : ordersRef;

    return onSnapshot(q, (snapshot) => {
        const cloudOrders = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Order));
        
        // Merge with local storage to ensure "Offline" orders are visible even when online
        const local = localStorage.getItem(`apexflow_local_orders`);
        let localOrders: Order[] = [];
        try {
            localOrders = local ? JSON.parse(local) : [];
            if (!Array.isArray(localOrders)) localOrders = [];
        } catch (e) {
            localOrders = [];
        }

        const merged = [...cloudOrders];
        localOrders.forEach(lOrder => {
            if (lOrder && lOrder.id && !merged.find(cOrder => cOrder.id === lOrder.id)) {
                if (!instanceId || lOrder.instanceId === instanceId) {
                    merged.push(lOrder);
                }
            }
        });

        // Sort by orderTime (desc)
        const sorted = merged.sort((a, b) => {
            const parseDate = (str: string) => {
                try {
                    const [dPart, tPart, ampm] = str.split(' ');
                    const [d, m, y] = dPart.split('/').map(Number);
                    let [hh, mm] = (tPart || '00:00').split(':').map(Number);
                    if (ampm === 'PM' && hh < 12) hh += 12;
                    if (ampm === 'AM' && hh === 12) hh = 0;
                    return new Date(y, m - 1, d, hh, mm).getTime();
                } catch (e) { return 0; }
            };
            return parseDate(b.orderTime) - parseDate(a.orderTime);
        });

        callback(sorted);
    }, (error) => {
        console.error("Error listening to orders:", error);
    });
};

// Listener for a SPECIFIC Order to enable real-time editing visibility
export const listenToOrderDetails = (orderId: string, callback: (order: Order) => void): (() => void) => {
    if (!db) return () => {};
    
    return onSnapshot(doc(db, KEYS.orders, orderId), (snapshot) => {
        if (snapshot.exists()) {
            callback({ ...snapshot.data(), id: snapshot.id } as Order);
        }
    }, (error) => {
        console.error(`Error listening to order ${orderId}:`, error);
    });
};

// --- Cloud Ping Logic ---

export const sendCloudPing = async (targetUserId: string, senderName: string, instanceId?: string, isManual = false) => {
    if (!db) return;
    try {
        const pingsRef = collection(db, KEYS.pings);
        const newPing = {
            targetUserId,
            senderName,
            instanceId: instanceId || 'global',
            timestamp: serverTimestamp(),
            played: false,
            isManual: isManual // Sounds will trigger based on this
        };
        const docId = `ping-${Date.now()}-${targetUserId}`;
        await setDoc(doc(db, KEYS.pings, docId), newPing);
    } catch (e) {
        console.error("Failed to send cloud ping:", e);
    }
};

export const listenToMyPings = (userId: string, callback: (ping: PingNotification) => void) => {
    if (!db) return () => {};
    
    const pingsRef = collection(db, KEYS.pings);
    const q = query(
        pingsRef, 
        where("targetUserId", "==", userId),
        where("played", "==", false),
        limit(1)
    );

    return onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const ping = { ...change.doc.data(), id: change.doc.id } as PingNotification;
                callback(ping);
            }
        });
    });
};

export const markPingAsPlayed = async (pingId: string) => {
    if (!db) return;
    try {
        await deleteDoc(doc(db, KEYS.pings, pingId));
    } catch (e) {
        console.error("Failed to clear ping:", e);
    }
};

// --- Public API Methods ---

export const fetchUsers = (instanceId?: string): Promise<User[]> => 
    getData(KEYS.users, 'users', MOCK_USERS, instanceId);

export const addUserToDB = (user: User) => 
    saveData(KEYS.users, 'users', user);

export const updateUserInDB = (user: User) => 
    saveData(KEYS.users, 'users', user, true);

export const fetchOrders = (instanceId?: string): Promise<Order[]> => 
    getData(KEYS.orders, 'orders', [], instanceId);

export const addOrderToDB = (order: Order) => 
    saveData(KEYS.orders, 'orders', order);

export const updateOrderInDB = (order: Order) => 
    saveData(KEYS.orders, 'orders', order, true);

export const deleteOrderFromDB = (id: string) => 
    removeData(KEYS.orders, 'orders', id);

export const fetchCustomers = (instanceId?: string): Promise<Customer[]> => 
    getData(KEYS.customers, 'customers', MOCK_CUSTOMERS, instanceId);

export const addCustomerToDB = (customer: Customer) => 
    saveData(KEYS.customers, 'customers', customer);

export const updateCustomerInDB = (customer: Customer) => 
    saveData(KEYS.customers, 'customers', customer, true);

export const fetchInventory = (instanceId?: string): Promise<InventoryItem[]> => 
    getData(KEYS.inventory, 'inventory', MOCK_INVENTORY, instanceId);

export const addInventoryItemToDB = (item: InventoryItem) => 
    saveData(KEYS.inventory, 'inventory', item);

export const updateInventoryItemInDB = (item: InventoryItem) => 
    saveData(KEYS.inventory, 'inventory', item, true);

export const fetchInventoryLogs = (instanceId?: string): Promise<InventoryLog[]> => 
    getData(KEYS.inventory_logs, 'inventory_logs', [], instanceId);

export const addInventoryLogToDB = (log: InventoryLog) => 
    saveData(KEYS.inventory_logs, 'inventory_logs', log);

export const deleteInventoryLogFromDB = (id: string) => 
    removeData(KEYS.inventory_logs, 'inventory_logs', id);

export const fetchFirms = (instanceId?: string): Promise<Firm[]> => 
    getData(KEYS.firms, 'firms', [], instanceId);

export const addFirmToDB = (firm: Firm) => 
    saveData(KEYS.firms, 'firms', firm);

export const updateFirmInDB = (firm: Firm) => 
    saveData(KEYS.firms, 'firms', firm, true);

export const fetchLinks = (instanceId?: string) => 
    getData(KEYS.links, 'links', [], instanceId);

export const addLinkToDB = (link: any) => 
    saveData(KEYS.links, 'links', link);

export const updateLinkInDB = (link: any) => 
    saveData(KEYS.links, 'links', link, true);

export const deleteLinkFromDB = (id: string) => 
    removeData(KEYS.links, 'links', id);

export const fetchGroups = (instanceId?: string) => 
    getData(KEYS.groups, 'groups', [], instanceId);

export const addGroupToDB = (group: any) => 
    saveData(KEYS.groups, 'groups', group);

export const updateGroupInDB = (group: any) => 
    saveData(KEYS.groups, 'groups', group, true);

export const deleteGroupFromDB = (id: string) => 
    removeData(KEYS.groups, 'groups', id);

export const fetchRolePermissions = async (): Promise<RolePermissions[]> => {
    const defaultPerms = [
        { role: 'Super Admin', allowedModules: ['orders', 'clients', 'links', 'broadcast', 'models', 'users', 'reports'] },
        { role: 'Picker', allowedModules: ['orders'] },
        { role: 'Checker', allowedModules: ['orders'] },
        { role: 'Dispatcher', allowedModules: ['orders'] },
        { role: 'GR', allowedModules: ['clients'] }
    ];
    const data = await getData(KEYS.role_permissions, 'role_permissions', defaultPerms.map(p => ({ ...p, id: p.role })));
    return data.map((d: any) => ({ role: d.role, allowedModules: d.allowedModules }));
};

export const updateRolePermissions = (permission: RolePermissions) => 
    saveData(KEYS.role_permissions, 'role_permissions', { ...permission, id: permission.role }, true);

export const fetchMasterRecords = async (type: string): Promise<string[]> => {
    const data = await getData(`master_${type}`, `master_${type}`, []);
    return data.map((d: any) => d.value).sort();
};

export const addMasterRecord = (type: string, value: string) => {
    const id = `${type}_${value.replace(/\s+/g, '_').toLowerCase()}`;
    return saveData(`master_${type}`, `master_${type}`, { id, value: value.toUpperCase() });
};

export const deleteMasterRecord = (type: string, value: string) => {
    const id = `${type}_${value.replace(/\s+/g, '_').toLowerCase()}`;
    return removeData(`master_${type}`, `master_${type}`, id);
};