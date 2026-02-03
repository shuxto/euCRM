import { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, Minimize2, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface AiAssistantProps {
  userId: string;
  onClose: () => void;
  minimized: boolean;
  onToggleMinimize: () => void;
}

export default function AiAssistant({ userId, onClose, minimized, onToggleMinimize }: AiAssistantProps) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    loadHistory();
    const unsub = subscribeToMessages();
    return () => { unsub(); };
  }, [userId]);

  // Auto-scroll whenever messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, minimized, loading]);

  const loadHistory = async () => {
    const { data } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (data) setMessages(data as AiMessage[]);
  };

  const subscribeToMessages = () => {
    const sub = supabase
      .channel('ai-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_messages', filter: `user_id=eq.${userId}` }, (payload) => {
        const newMsg = payload.new as AiMessage;
        
        setMessages((prev) => {
          // --- SMART DEDUPLICATION ---
          // 1. Check by ID
          if (prev.some(m => m.id === newMsg.id)) return prev;
          
          // 2. Check by Content (To prevent double bubbles if we added it manually)
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && 
              lastMsg.role === newMsg.role && 
              lastMsg.content === newMsg.content) {
              return prev; 
          }

          return [...prev, newMsg];
        });
      })
      .subscribe();
      
    return () => supabase.removeChannel(sub);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. SHOW USER MESSAGE INSTANTLY (Optimistic Update)
      const tempUserMsg: AiMessage = {
          id: 'temp-user-' + Date.now(),
          role: 'user',
          content: userText,
          created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempUserMsg]);

      // 2. SAVE TO DB
      const { error: dbError } = await supabase.from('ai_messages').insert({
        user_id: userId,
        role: 'user',
        content: userText
      });

      if (dbError) throw new Error("Could not save message to DB");

      // 3. REFRESH SESSION (To avoid 401 Errors)
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session) throw new Error("Login expired. Please refresh.");

      // 4. CALL AI
      const { data, error: fnError } = await supabase.functions.invoke('chat-ai', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { message: userText, userId: userId }
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      // 5. SHOW AI REPLY INSTANTLY (Fixes "Need Refresh")
      if (data?.reply) {
         const tempAiMsg: AiMessage = {
             id: 'temp-ai-' + Date.now(),
             role: 'assistant',
             content: data.reply,
             created_at: new Date().toISOString()
         };
         setMessages(prev => [...prev, tempAiMsg]);
      }

    } catch (err: any) {
      console.error('AI Error:', err);
      // Remove the optimistic message if it failed? (Optional, skipping for simplicity)
      if (err.message.includes('401')) {
         setErrorMsg("Auth Error. Refresh page.");
      } else {
         setErrorMsg(err.message || "Failed to connect to AI");
      }
    } finally {
      setLoading(false);
    }
  };

  if (minimized) {
    return (
      <div className="fixed bottom-4 right-20 z-50 animate-in slide-in-from-bottom-5">
        <button 
          onClick={onToggleMinimize}
          className="bg-slate-900 border border-emerald-500/30 text-white p-3 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-110 transition-transform flex items-center gap-2"
        >
          <div className="relative">
            <Bot size={24} className="text-emerald-400" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <span className="font-bold text-sm pr-2">AI Assistant</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-20 z-50 w-100 h-150 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
      
      {/* Header */}
      <div className="h-16 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Bot size={20} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">CRM Assistant</h3>
            <p className="text-xs text-emerald-400/80 flex items-center gap-1">
              <Sparkles size={10} /> Online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onToggleMinimize} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <Minimize2 size={16} />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent" ref={scrollRef}>
        {messages.length === 0 && !loading && (
          <div className="text-center mt-20 opacity-50">
            <Bot size={48} className="mx-auto mb-4 text-emerald-500/30" />
            <p className="text-sm text-slate-400">Ask me anything about your leads, <br/> scripts, or daily tasks.</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`
              max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed
              ${msg.role === 'user' 
                ? 'bg-emerald-600 text-white rounded-br-sm' 
                : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-sm'}
            `}>
              {msg.content}
            </div>
          </div>
        ))}
        
        {errorMsg && (
            <div className="flex justify-center animate-in fade-in">
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2 rounded-lg text-xs flex items-center gap-2">
                    <AlertCircle size={14} />
                    {errorMsg}
                </div>
            </div>
        )}

        {loading && (
          <div className="flex justify-start animate-in fade-in">
             <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl rounded-bl-sm flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-emerald-400" />
                <span className="text-xs text-slate-400">Thinking...</span>
             </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900/50 border-t border-slate-800 backdrop-blur-md">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-slate-600"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}