
import React, { useState, useMemo, useEffect } from 'react';
import { 
    X, Send, Users, CheckCircle2, Loader2, AlertCircle, 
    MessageSquare, ShieldCheck, Zap, ArrowRight, Smartphone,
    Check, Info, Radio, Search
} from 'lucide-react';
import { Customer, User } from '../types';
import { useNotification } from '../context/NotificationContext';

interface BulkWhatsAppModalProps {
    isOpen: boolean;
    onClose: () => void;
    customers: Customer[];
    initialMessage: string;
    title: string;
    instanceId?: string;
}

interface SendStatus {
    id: string;
    name: string;
    phone: string;
    status: 'pending' | 'sending' | 'success' | 'failed';
    error?: string;
}

const BulkWhatsAppModal: React.FC<BulkWhatsAppModalProps> = ({ 
    isOpen, onClose, customers, initialMessage, title, instanceId 
}) => {
    const { showNotification } = useNotification();
    const [step, setStep] = useState<'config' | 'sending' | 'report'>('config');
    const [message, setMessage] = useState(initialMessage);
    const [selectedIds, setSelectedIds] = useState<string[]>(customers.map(c => c.id));
    const [searchTerm, setSearchTerm] = useState('');
    const [sendProgress, setSendProgress] = useState<SendStatus[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const filteredRecipients = useMemo(() => {
        return customers.filter(c => 
            (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
            (c.phone || '').includes(searchTerm)
        );
    }, [customers, searchTerm]);

    const handleToggleRecipient = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleSelectAll = () => {
        if (selectedIds.length === customers.length) setSelectedIds([]);
        else setSelectedIds(customers.map(c => c.id));
    };

    const startBulkSending = async () => {
        if (selectedIds.length === 0) return;
        
        setIsProcessing(true);
        setStep('sending');
        
        const recipients = customers.filter(c => selectedIds.includes(c.id));
        const initialStatus: SendStatus[] = recipients.map(r => ({
            id: r.id, name: r.name, phone: r.phone, status: 'pending'
        }));
        setSendProgress(initialStatus);

        // Simulation/API Loop
        for (let i = 0; i < initialStatus.length; i++) {
            const current = initialStatus[i];
            
            // Update UI to "sending"
            setSendProgress(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'sending' } : s));

            try {
                /** 
                 * REAL API INTEGRATION POINT
                 * await fetch('https://api.your-provider.com/v1/send', {
                 *   method: 'POST',
                 *   headers: { 'Authorization': 'Bearer YOUR_KEY' },
                 *   body: JSON.stringify({ phone: current.phone, message: message })
                 * });
                 */
                
                // Simulating network delay for safety (WhatsApp protection)
                await new Promise(resolve => setTimeout(resolve, 800)); 
                
                setSendProgress(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'success' } : s));
            } catch (err) {
                setSendProgress(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'failed', error: 'API Timeout' } : s));
            }
        }

        setIsProcessing(false);
        setStep('report');
        showNotification(`Bulk transmission complete for ${recipients.length} nodes`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                
                {/* Header */}
                <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                            <Zap size={28} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">{title}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Bulk API Transmission Hub</p>
                        </div>
                    </div>
                    {step !== 'sending' && (
                        <button onClick={onClose} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all hover:rotate-90">
                            <X size={24} />
                        </button>
                    )}
                </div>

                {step === 'config' && (
                    <div className="flex-1 flex flex-col md:flex-row min-h-0">
                        {/* Left: Message Preview */}
                        <div className="flex-1 p-10 space-y-8 bg-slate-50/30 border-r border-slate-100">
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Message Content (Templates Allowed)</label>
                                <textarea 
                                    value={message} 
                                    onChange={e => setMessage(e.target.value)}
                                    className="w-full h-[300px] p-8 bg-white border border-slate-200 rounded-[2rem] text-sm font-bold text-slate-600 outline-none focus:border-emerald-500 shadow-inner resize-none leading-relaxed"
                                />
                            </div>
                            <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl flex items-start gap-4">
                                <Info className="text-blue-500 shrink-0" size={20} />
                                <p className="text-[11px] font-bold text-blue-700 leading-relaxed uppercase tracking-tight">
                                    Official WhatsApp API is required for bulk sending. 
                                    Each message is queued to prevent account suspension.
                                </p>
                            </div>
                        </div>

                        {/* Right: Recipient Selector */}
                        <div className="w-full md:w-[380px] flex flex-col p-8 bg-white shrink-0">
                            <div className="mb-6 flex items-center justify-between">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Recipients</h4>
                                <button onClick={handleSelectAll} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">
                                    {selectedIds.length === customers.length ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            
                            <div className="relative mb-4">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input 
                                    type="text" 
                                    placeholder="Search..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {filteredRecipients.map(c => (
                                    <button 
                                        key={c.id} 
                                        onClick={() => handleToggleRecipient(c.id)}
                                        className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group ${selectedIds.includes(c.id) ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-50 hover:border-emerald-100'}`}
                                    >
                                        <div className="min-w-0 pr-2">
                                            <p className={`text-[12px] font-black uppercase tracking-tight truncate ${selectedIds.includes(c.id) ? 'text-emerald-700' : 'text-slate-800'}`}>{c.name}</p>
                                            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{c.phone}</p>
                                        </div>
                                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.includes(c.id) ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200'}`}>
                                            {selectedIds.includes(c.id) && <Check size={12} strokeWidth={4}/>}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="pt-6 border-t border-slate-100 mt-6">
                                <button 
                                    onClick={startBulkSending} 
                                    disabled={selectedIds.length === 0}
                                    className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[12px] tracking-[0.2em] shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    Launch Bulk Send ({selectedIds.length}) <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'sending' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50/30">
                        <div className="w-full max-w-lg space-y-10">
                            <div className="text-center space-y-4">
                                <div className="relative inline-block">
                                    <div className="w-24 h-24 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center text-emerald-600 shadow-inner">
                                        <Loader2 size={40} className="animate-spin" />
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center">
                                        <Smartphone size={20} className="text-indigo-600" />
                                    </div>
                                </div>
                                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Transmitting Data...</h3>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                                    Sending {sendProgress.filter(s => s.status === 'success').length} of {sendProgress.length} Messages
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                        className="h-full bg-emerald-500 transition-all duration-500" 
                                        style={{ width: `${(sendProgress.filter(s => s.status === 'success').length / sendProgress.length) * 100}%` }}
                                    />
                                </div>
                                <div className="bg-white rounded-3xl border border-slate-100 p-6 max-h-[250px] overflow-y-auto custom-scrollbar shadow-sm">
                                    {sendProgress.map(s => (
                                        <div key={s.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${s.status === 'success' ? 'bg-emerald-500' : s.status === 'sending' ? 'bg-indigo-500 animate-pulse' : s.status === 'failed' ? 'bg-rose-500' : 'bg-slate-300'}`}></div>
                                                <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{s.name}</span>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase tracking-widest ${s.status === 'success' ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                {s.status === 'success' ? 'Delivered' : s.status === 'failed' ? 'Failed' : s.status.toUpperCase()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'report' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white">
                        <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center text-white mb-8 shadow-2xl shadow-emerald-100">
                            <CheckCircle2 size={48} strokeWidth={3} />
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-2 text-center">Batch Processed</h2>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px] mb-10">Total Messages Processed: {sendProgress.length}</p>
                        
                        <div className="grid grid-cols-2 gap-6 w-full max-w-md mb-12">
                            <div className="p-8 bg-emerald-50 rounded-[2rem] border border-emerald-100 text-center">
                                <p className="text-4xl font-black text-emerald-600 tracking-tighter mb-2">{sendProgress.filter(s => s.status === 'success').length}</p>
                                <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest">SUCCESSFUL</p>
                            </div>
                            <div className="p-8 bg-rose-50 rounded-[2rem] border border-rose-100 text-center">
                                <p className="text-4xl font-black text-rose-600 tracking-tighter mb-2">{sendProgress.filter(s => s.status === 'failed').length}</p>
                                <p className="text-[10px] font-black text-rose-600/60 uppercase tracking-widest">FAILED</p>
                            </div>
                        </div>

                        <button onClick={onClose} className="px-16 py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-[12px] uppercase tracking-[0.3em] shadow-xl hover:bg-slate-800 transition-all active:scale-95">Return to Console</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkWhatsAppModal;
