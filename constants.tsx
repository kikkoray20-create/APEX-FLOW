
import React from 'react';
import { 
  ShoppingBag, 
  Users, 
  Radio, 
  Link as LinkIcon, 
  Box, 
  Layers, 
  UserCog, 
  FileText,
  Package,
  CheckCircle,
  Truck,
  Clock,
  Send,
  UserPlus,
  ShieldAlert
} from 'lucide-react';
import { Order, StatCardData, SidebarItem, OrderItem, InventoryItem, User, Customer, Firm } from './types';

export const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: 'orders', label: 'Orders', icon: <ShoppingBag size={18} />, active: true },
  { 
    id: 'clients', 
    label: 'Clients', 
    icon: <Users size={18} />, 
    subItems: [
      { label: 'Clients', id: 'clients' },
      { label: 'Client Firms', id: 'customer_firms' },
      { label: 'Client GR', id: 'customer_gr' }
    ],
    isOpen: false 
  },
  { id: 'links', label: 'Links', icon: <LinkIcon size={18} /> },
  { id: 'broadcast', label: 'Broadcast Groups', icon: <Radio size={18} /> },
  { id: 'models', label: 'Model & Inventory', icon: <Box size={18} />, subItems: [{ label: 'Shop Model List', id: 'models' }, { label: 'Inventory', id: 'inventory' }], isOpen: false },
  { 
    id: 'users', 
    label: 'User Management', 
    icon: <UserCog size={18} />, 
    subItems: [
        { label: 'Team Registry', id: 'users' },
        { label: 'Master Control', id: 'master_control' }
    ],
    isOpen: false 
  },
  { 
    id: 'reports', 
    label: 'Reports', 
    icon: <FileText size={18} />, 
    subItems: [
      { label: 'Order Reports', id: 'order_reports' },
      { label: 'Client Order Report', id: 'customer_order_report' },
      { label: 'Daily Fulfilled Summary', id: 'order_summary' }
    ], 
    isOpen: false 
  },
];

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'ApexFlow Admin', role: 'Super Admin', phone: '1231231231', password: '123', active: true },
  { id: 'u2', name: 'Ramesh Picker', role: 'Picker', phone: '9876543211', password: '123', active: true },
  { id: 'u3', name: 'Suresh Packer', role: 'Dispatcher', phone: '9876543212', password: '123', active: true },
  { id: 'u4', name: 'Mahesh Checker', role: 'Checker', phone: '9876543213', password: '123', active: true },
];

export const MOCK_FIRMS: Firm[] = [
  { id: 'f1', name: 'SKYLINE DISTRIBUTORS', gstin: '27AAACS1234A1Z1', address: 'Bandra West, Mumbai', createdAt: '2024-01-01T10:00:00Z' },
  { id: 'f2', name: 'RELIANCE RETAIL CORE', gstin: '07BBBCD5678B2Z2', address: 'Connaught Place, Delhi', createdAt: '2024-02-15T11:30:00Z' }
];

export const MOCK_CUSTOMERS: Customer[] = [
  { 
    id: 'c1', 
    name: 'RAJESH MOBILE STORE', 
    nickname: 'Rajesh Bhai', 
    phone: '+91 9829012345', 
    city: 'Mumbai', 
    state: 'Maharashtra', 
    type: 'Owner', 
    status: 'Approved', 
    createdAt: '12/05/2024', 
    totalOrders: 12, 
    balance: 4500,
    firmId: 'SKYLINE DISTRIBUTORS'
  },
  { 
    id: 'c2', 
    name: 'KAPIL TELECOM', 
    nickname: 'Kapil', 
    phone: '+91 9829054321', 
    city: 'Delhi', 
    state: 'NCR', 
    type: 'Owner', 
    status: 'Approved', 
    createdAt: '15/06/2024', 
    totalOrders: 5, 
    balance: -1200
  },
  { 
    id: 'c3', 
    name: 'AMIT COMMUNICATION', 
    nickname: 'Amit Ji', 
    phone: '+91 9414067890', 
    city: 'Jaipur', 
    state: 'Rajasthan', 
    type: 'Agent', 
    status: 'Approved', 
    createdAt: '20/07/2024', 
    totalOrders: 28, 
    balance: 15600,
    firmId: 'SKYLINE DISTRIBUTORS'
  },
  { 
    id: 'c4', 
    name: 'SURESH ELECTRONICS', 
    nickname: 'Suresh', 
    phone: '+91 7737421738', 
    city: 'Surat', 
    state: 'Gujarat', 
    type: 'Owner', 
    status: 'Pending', 
    createdAt: '01/08/2024', 
    totalOrders: 0, 
    balance: 0
  },
  { 
    id: 'c5', 
    name: 'MODERN GADGETS', 
    nickname: 'Modern', 
    phone: '+91 9988776655', 
    city: 'Bangalore', 
    state: 'Karnataka', 
    type: 'Owner', 
    status: 'Approved', 
    createdAt: '10/08/2024', 
    totalOrders: 3, 
    balance: 2100
  }
];

export const MOCK_INVENTORY: InventoryItem[] = [
  {
    id: 'inv1',
    brand: 'APPLE',
    quality: 'ORIGINAL',
    category: 'Premium',
    model: 'IPHONE 15 PRO MAX DISPLAY',
    warehouse: 'Main Warehouse',
    price: 18500.0,
    quantity: 15,
    status: 'Active',
    location: 'R1-A'
  },
  {
    id: 'inv2',
    brand: 'SAMSUNG',
    quality: 'PREMIUM',
    category: 'Display',
    model: 'S23 ULTRA CURVED PANEL',
    warehouse: 'Main Warehouse',
    price: 12400.0,
    quantity: 22,
    status: 'Active',
    location: 'R1-B'
  },
  {
    id: 'inv3',
    brand: 'REALME',
    quality: 'HD+',
    category: 'General',
    model: 'NARZO 50 / 50 PRO 5G',
    warehouse: 'Main Warehouse',
    price: 1150.0,
    quantity: 140,
    status: 'Active',
    location: 'R5-C'
  },
  {
    id: 'inv4',
    brand: 'OPPO',
    quality: 'OG',
    category: 'Display',
    model: 'RENO 10 PRO 5G FOLDER',
    warehouse: 'Main Warehouse',
    price: 4800.0,
    quantity: 45,
    status: 'Active',
    location: 'R2-D'
  },
  {
    id: 'inv5',
    brand: 'VIVO',
    quality: 'PREMIUM',
    category: 'General',
    model: 'V27 / V29 PRO COMBO',
    warehouse: 'Main Warehouse',
    price: 3200.0,
    quantity: 60,
    status: 'Active',
    location: 'R3-B'
  },
  {
    id: 'inv6',
    brand: 'XIAOMI',
    quality: 'HD+',
    category: 'Display',
    model: 'NOTE 12 PRO 5G DISPLAY',
    warehouse: 'Main Warehouse',
    price: 2100.0,
    quantity: 85,
    status: 'Active',
    location: 'R4-A'
  },
  {
    id: 'inv7',
    brand: 'ONEPLUS',
    quality: 'ORIGINAL',
    category: 'Premium',
    model: '11R FLUID AMOLED PANEL',
    warehouse: 'Main Warehouse',
    price: 9500.0,
    quantity: 12,
    status: 'Active',
    location: 'R1-D'
  },
  {
    id: 'inv8',
    brand: 'MOTOROLA',
    quality: 'OG',
    category: 'General',
    model: 'EDGE 40 FUSION',
    warehouse: 'Main Warehouse',
    price: 3800.0,
    quantity: 30,
    status: 'Active',
    location: 'R2-B'
  }
];

export const MOCK_ORDERS: Order[] = [];

export const MOCK_ORDER_ITEMS: Record<string, OrderItem[]> = {};

export const STATS_DATA: StatCardData[] = [
  { label: 'Total', value: 0, colorClass: 'bg-blue-50', iconColorClass: 'text-blue-500', icon: <ShoppingBag size={20}/> },
  { label: 'Fresh', value: 0, colorClass: 'bg-red-50', iconColorClass: 'text-red-500', icon: <Package size={20}/> },
  { label: 'Assigned', value: 0, colorClass: 'bg-purple-50', iconColorClass: 'text-purple-600', icon: <UserPlus size={20}/> },
  { label: 'Packed', value: 0, colorClass: 'bg-yellow-50', iconColorClass: 'text-yellow-600', icon: <Box size={20}/> },
  { label: 'Checked', value: 0, colorClass: 'bg-green-50', iconColorClass: 'text-green-500', icon: <CheckCircle size={20}/> },
  { label: 'Dispatched', value: 0, colorClass: 'bg-orange-50', iconColorClass: 'text-orange-500', icon: <Truck size={20}/> },
  { label: 'Sent', value: 0, colorClass: 'bg-cyan-50', iconColorClass: 'text-cyan-500', icon: <Send size={20}/> },
  { label: 'Pending', value: 0, colorClass: 'bg-orange-100', iconColorClass: 'text-orange-600', icon: <Clock size={20}/> },
];
