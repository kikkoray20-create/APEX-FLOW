
import React, { useState, useRef, useEffect } from 'react';
import { 
    X, Send, Sparkles, Bot, User, Loader2, 
    TrendingUp, AlertCircle, ShoppingBag, 
    ArrowRight, Globe, ExternalLink, ChevronDown,
    Zap, BrainCircuit, Terminal
} from 'lucide-react';
import { getAIResponseStream } from '../services/geminiService';
import { Order, InventoryItem, Customer } from '../types';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    grounding?: Array<{ uri: string; title: string }>;
}

interface AIAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    orders: Order[];
    inventory: InventoryItem[];
    customers: Customer[];
}

const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, orders, inventory, customers }) => {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'System initialized. I have indexed your orders and inventory. How can I assist your workflow today?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleSend = async (forcedPrompt?: string) => {
        const query = forcedPrompt || input;
        if (!query.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: query };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);
        
        const context = { orders, inventory, customers };
        // Detect if market trends or external search is needed
        const needsSearch = query.toLowerCase().includes('market') || 
                           query.toLowerCase().includes('price in') || 
                           query.toLowerCase().includes('trend');

        try {
            const stream = await getAIResponseStream(query, context, needsSearch);
            setIsStreaming(true);
            
            let assistantContent = '';
            let groundingLinks: any[] = [];

            // Add empty assistant message to be updated by stream
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            for await (const chunk of stream) {
                assistantContent += chunk.text || '';
                
                // Extract grounding if available (usually in the first/last chunks)
                const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                if (chunks) {
                    const newLinks = chunks
                        .filter((c: any) => c.web)
                        .map((c: any) => ({ uri: c.web.uri, title: c.web.title }));
                    groundingLinks = [...groundingLinks, ...newLinks];
                }

                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    const rest = prev.slice(0, -1);
                    return [...rest, { ...last, content: assistantContent, grounding: groundingLinks.length > 0 ? groundingLinks : undefined }];
                });
            }
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Protocol error: Connection to Intelligence Node timed out. Please verify your API clearance.' }]);
        } finally {
            setIsLoading(false);
            setIsStreaming(false);
        }
    };

    const chips = [
        { label: 'Stock Health', icon: <TrendingUp size={12}/>, prompt: 'Which inventory items are critically low and need immediate reordering?' },
        { label: 'Order Bottlenecks', icon: <AlertCircle size={12}/>, prompt: 'Analyze pending orders and identify any that have been fresh for over 24 hours.' },
        { label: 'Market Prices', icon: <Globe size={12}/>, prompt: 'What are the current wholesale market trends for mobile display panels in 2025?' },
        { label: 'Credit Risk', icon: <ShoppingBag size={12}/>, prompt: 'Identify customers with high negative balances and summarize their recent ordering frequency.' }
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 md:inset-auto md:bottom-6 md:right-6 z-[100] flex flex-col md:w-[420px] md:h-[650px] bg-white md:rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-right-10 duration-300">
            {/* Header */}
            <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/20">
                        <BrainCircuit size={22} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest leading-none">ApexFlow Intel</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-1.5">
                            <Zap size={10} className="text-amber-400 fill-amber-400" /> Neural Mode Active
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Chat Body */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar space-y-6">
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex gap-3 mb-4">
                    <Terminal size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-indigo-700 leading-relaxed uppercase tracking-tight">
                        AI Strategist connected to your database instance. Current context: {orders.length} orders & {inventory.length} models indexed.
                    </p>
                </div>

                {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`flex gap-3 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center shadow-sm ${msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'}`}>
                                {msg.role === 'user' ? <User size={16} /> : <Bot size={18} />}
                            </div>
                            <div className={`p-4 rounded-2xl text-[13px] leading-relaxed font-medium shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'}`}>
                                <div className="whitespace-pre-wrap prose prose-slate max-w-none prose-sm">
                                    {msg.content || (isLoading && i === messages.length - 1 ? <div className="flex gap-1 py-1"><div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div><div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div></div> : null)}
                                </div>
                                
                                {msg.grounding && msg.grounding.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Globe size={10} /> Verified Sources
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {msg.grounding.map((link, idx) => (
                                                <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 transition-all truncate max-w-[180px]">
                                                    {link.title} <ExternalLink size={10} />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-slate-100 shrink-0">
                {messages.length < 3 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                        {chips.map((chip, i) => (
                            <button key={i} onClick={() => handleSend(chip.prompt)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-full text-[10px] font-bold text-slate-600 hover:text-indigo-600 transition-all active:scale-95">
                                {chip.icon} {chip.label}
                            </button>
                        ))}
                    </div>
                )}
                
                <div className="relative group">
                    <input 
                        type="text" 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="Analyze orders or search trends..."
                        className="w-full pl-6 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner"
                    />
                    <button 
                        onClick={() => handleSend()}
                        disabled={isLoading || !input.trim()}
                        className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 rounded-xl transition-all ${input.trim() ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200 text-slate-400'}`}
                    >
                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} strokeWidth={2.5} />}
                    </button>
                </div>
                <p className="text-[8px] font-bold text-slate-300 text-center uppercase tracking-[0.2em] mt-4">ApexFlow Intelligence Node v3.0</p>
            </div>
        </div>
    );
};

export default AIAssistant;
