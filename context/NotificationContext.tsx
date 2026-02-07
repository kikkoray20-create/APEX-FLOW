
import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, Check, AlertCircle, Info } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info';

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);

  const showNotification = useCallback((message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
    // Auto hide after 3 seconds
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100 min-w-[200px]">
            {notification.type === 'success' && (
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                    <Check size={12} className="text-white" strokeWidth={3} />
                </div>
            )}
            {notification.type === 'error' && (
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shrink-0">
                    <AlertCircle size={12} className="text-white" strokeWidth={2.5} />
                </div>
            )}
            {notification.type === 'info' && (
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                    <Info size={12} className="text-white" strokeWidth={2.5} />
                </div>
            )}
            
            <div className="flex-1 mr-1">
                <span className="text-[12px] font-bold text-slate-700">{notification.message}</span>
            </div>

            <button 
                onClick={() => setNotification(null)} 
                className="p-1 rounded-full hover:bg-slate-100 text-slate-300 hover:text-slate-500 transition-colors"
            >
                <X size={12} />
            </button>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};
