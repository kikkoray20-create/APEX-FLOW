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

// Direct Cloud search for Login to bypass global fetch issues
export const findUserByPhoneDirect = async (phone: string): Promise<User | null> => {
    if (!db) return null;
    try {
        console.log(`🛰️ Searching Cloud for Phone: ${phone}...`);
        const usersRef = collection(db, KEYS.users);
        const q = query(usersRef, where("phone", "==", phone));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data() as User;
            console.log("✅ Cloud User Found:", userData.name);
            return { ...userData, id: querySnapshot.docs[0].id };
        }
        
        // Try fallback: number might be stored without country code or with spaces
        // If the above failed, we can't do complex filters in Firestore without index,
        // so we'll rely on the main Login logic fallback to fetchUsers().
        return null;
    } catch (e) {
        console.error("❌ Direct User Fetch Error:", e);
        return null;
    }
};

// Universal fetcher with Cloud Priority & Intelligent Merging
const getData = async (collectionName: string, localKey: string, fallbackData: any[] = [], instanceId?: string, bypassCache = false) => {
    const localStoreKey = `apexflow_local_${localKey}`;
    
    if (db) {
        try {
            const collectionRef = collection(db, collectionName);
            const q = instanceId 
                ? query(collectionRef, where("instanceId", "==", instanceId))
                : collectionRef;
                
            const querySnapshot = await getDocs(q);
            console.log(`📦 Cloud Sync [${collectionName}]: Found ${querySnapshot.size} documents.`);
            
            const cloudData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            
            if (cloudData.length > 0) {
                localStorage.setItem(localStoreKey, JSON.stringify(cloudData));
                return cloudData;
            } else if (querySnapshot.size === 0 && !bypassCache) {
                console.warn(`⚠️ Collection [${collectionName}] is empty in Cloud.`);
            }
        } catch (e) {
            console.warn(`🛰️ Cloud fetch failed for [${collectionName}]. Error:`, e);
            if (bypassCache) throw e; 
        }
    }

    if (bypassCache) return [];

    const local = localStorage.getItem(localStoreKey);
    let parsed: any[] = [];
    
    try {
        parsed = local ? JSON.parse(local) : [];
        if (!Array.isArray(parsed)) parsed = [];
    } catch (error) {
        parsed = [];
    }
    
    if (parsed.length === 0 && fallbackData.length > 0) {
        return fallbackData;
    }

    return instanceId 
        ? parsed.filter((item: any) => item && (!item.instanceId || item.instanceId === instanceId))
        : parsed;
};

// Universal saver with Cloud Sync
const saveData = async (collectionName: string, localKey: string, data: any, isUpdate = false) => {
    const localStoreKey = `apexflow_local_${localKey}`;
    
    if (db) {
        try {
            const docRef = data.id ? doc(db, collectionName, data.id) : doc(collection(db, collectionName));
            const docId = docRef.id;
            const finalData = { ...data, id: docId, updatedAt: new Date().toISOString() };
            await setDoc(docRef, finalData, { merge: true });
            data = finalData;
        } catch (e) {
            console.error("❌ Cloud sync failed:", e);
        }
    }

    const localStr = localStorage.getItem(localStoreKey);
    let localData: any[] = [];
    try {
        localData = localStr ? JSON.parse(localStr) : [];
        if (!Array.isArray(localData)) localData = [];
    } catch (e) {
        localData = [];
    }
    
    if (isUpdate) {
        localData = localData.map((item: any) => item && item.id === data.id ? data : item);
    } else {
        const exists = localData.find((item: any) => item && item.id === data.id);
        if (!exists) localData = [data, ...localData];
    }
    localStorage.setItem(localStoreKey, JSON.stringify(localData));
    return data;
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
        const orders = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Order));
        callback(orders);
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

export const fetchUsers = (instanceId?: string, bypassCache = false): Promise<User[]> => 
    getData(KEYS.users, 'users', MOCK_USERS, instanceId, bypassCache);

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