import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useSupportChat } from '../hooks/useSupportChat';
import { MessageCircle, Loader2, Send, Paperclip, Smile, X, Lock } from 'lucide-react';
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react';

export default function SupportPage({ currentUser }: { currentUser: any }) {
  // --- 1. LIST STATE ---
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  
  // --- STATES ---
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // --- IMAGE STATES ---
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  // Hook for the Chat Window
  const { messages, sending } = useSupportChat(selectedLeadId);
  const [replyText, setReplyText] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); 
  const isSendingRef = useRef(false);

  // --- INITIAL FETCH & LISTENERS ---
  useEffect(() => {
    fetchThreads();

    const channel = supabase.channel('support-list-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_messages' }, 
        (payload) => {
          if (payload.eventType === 'INSERT') {
             // Refresh threads to enforce visibility rules (Vanish logic)
             fetchThreads();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // --- FETCH THREADS (STRICT SECURITY VISIBILITY) ---
  const fetchThreads = async () => {
    setLoadingList(true);
    
    let query = supabase
        .from('crm_leads')
        .select('id, name, surname, email, assigned_to, country, trading_account_id')
        .order('last_assigned_at', { ascending: false });

    // *** STRICT VISIBILITY LOGIC ***
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        // Admin sees: Assigned to Me OR Unassigned
        query = query.or(`assigned_to.eq.${currentUser.id},assigned_to.is.null`);
    } else {
        // Agent sees: ONLY Assigned to Me. (Unassigned vanishes instantly)
        query = query.eq('assigned_to', currentUser.id);
    }
    
    const { data: leads } = await query;
    
    if (leads && leads.length > 0) {
        const leadIds = leads.map(l => l.id);
        const { data: msgData } = await supabase
            .from('support_messages')
            .select('lead_id, created_at, message_text, is_read, sender_id, sender_name, type') // Added sender_name
            .in('lead_id', leadIds)
            .order('created_at', { ascending: false });

        const mappedThreads = leads.map(lead => {
            const lastMsg = msgData?.find(m => m.lead_id === lead.id);
            if (!lastMsg) return null;

            return { 
                ...lead, 
                last_message: lastMsg,
                has_unread: !lastMsg.is_read && lastMsg.sender_id !== currentUser.id
            };
        });

        const activeThreads = mappedThreads.filter((t): t is NonNullable<typeof t> => t !== null);

        activeThreads.sort((a, b) => 
            new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
        );

        setThreads(activeThreads);
        
        // If the currently selected chat vanished (because I lost access), clear the selection
        if (selectedLeadId && !activeThreads.find(t => t.id === selectedLeadId)) {
            setSelectedLeadId(null);
        }

    } else {
        setThreads([]);
        if (selectedLeadId) setSelectedLeadId(null); // Clear selection if list empty
    }
    setLoadingList(false);
  };

  // --- AUTO SCROLL ---
  useEffect(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // --- AUTO-MARK READ ---
  useEffect(() => {
      if (!selectedLeadId || messages.length === 0) return;

      const hasUnread = messages.some(m => !m.is_read && m.sender_id !== currentUser.id);

      if (hasUnread) {
          const markAsRead = async () => {
              await supabase
                  .from('support_messages')
                  .update({ is_read: true })
                  .eq('lead_id', selectedLeadId)
                  .neq('sender_id', currentUser.id);
              
              window.dispatchEvent(new Event('crm-support-updated'));
          };
          markAsRead();
      }
  }, [messages, selectedLeadId]);

  const currentThread = threads.find(t => t.id === selectedLeadId);

  // --- SMART LOCK LOGIC (Who can type?) ---
  const isReadOnly = (() => {
      if (!currentThread) return true;
      
      // 1. Assigned to Me -> UNLOCKED
      if (currentThread.assigned_to === currentUser.id) return false;
      
      // 2. Unassigned -> ONLY Admin/Manager can type
      if (currentThread.assigned_to === null) {
          if (currentUser.role === 'admin' || currentUser.role === 'manager') return false;
          return true; // Agents cannot type/see unassigned
      }

      // 3. Assigned to someone else -> LOCKED
      return true;
  })();

  // --- ACTIONS ---
  const handleSelectChat = async (leadId: string) => {
      setSelectedLeadId(leadId);
      setThreads(prev => prev.map(t => t.id === leadId ? { ...t, has_unread: false } : t));
      
      await supabase.from('support_messages')
        .update({ is_read: true })
        .eq('lead_id', leadId)
        .neq('sender_id', currentUser.id);
      
      window.dispatchEvent(new Event('crm-support-updated'));
  };

  const handleSend = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      
      if (isSendingRef.current) return;
      if (isReadOnly) return; // SECURITY CHECK

      if (!selectedLeadId) return;
      if (!replyText.trim() && !previewFile) return;

      isSendingRef.current = true;
      setUploading(true);

      try {
          let finalMessage = replyText;
          let msgType = 'text';

          if (previewFile) {
              const fileExt = previewFile.name.split('.').pop();
              const fileName = `${Math.random()}.${fileExt}`;
              const filePath = `${selectedLeadId}/${fileName}`;

              const { error: uploadError } = await supabase.storage.from('support-attachments').upload(filePath, previewFile);
              if (uploadError) throw uploadError;

              const { data } = supabase.storage.from('support-attachments').getPublicUrl(filePath);
              finalMessage = data.publicUrl;
              msgType = 'image';
          }

          // GET REAL NAME (Try currentUser.name, then metadata, then fallback)
          const realName = currentUser.name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Agent';

          await supabase.from('support_messages').insert({
            lead_id: selectedLeadId,
            sender_id: currentUser.id,
            sender_name: realName, // SAVING REAL NAME
            recipient_id: currentThread?.trading_account_id,
            message_text: finalMessage,
            type: msgType,
            is_read: false
          });

          setReplyText('');
          setPreviewFile(null);
          setPreviewUrl(null);
          setShowEmoji(false);
          
      } catch (error) {
          console.error('Send failed:', error);
          alert('Failed to send message.');
      } finally {
          isSendingRef.current = false;
          setUploading(false);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setReplyText((prev) => prev + emojiData.emoji);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreviewFile(file);
    setPreviewUrl(objectUrl);
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] bg-[#0b0e11] text-white rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      
      {/* --- SIDEBAR LIST --- */}
      <div className="w-80 border-r border-white/10 flex flex-col bg-[#111827]">
        <div className="p-4 border-b border-white/10 shrink-0">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
                <MessageCircle className="text-green-400" /> 
                <span>Inbox</span>
            </h2>
            <p className="text-xs text-gray-500 mb-2">
                {currentUser.role === 'admin' || currentUser.role === 'manager' 
                    ? "Your Clients & Unassigned" 
                    : "Your Clients Only"}
            </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loadingList && <div className="p-4 text-center text-gray-500 text-xs">Loading...</div>}
            
            {!loadingList && threads.length === 0 && (
                <div className="p-8 text-center text-gray-600 text-sm">No active chats found.</div>
            )}

            {threads.map((t: any) => (
                <div 
                    key={t.id} 
                    onClick={() => handleSelectChat(t.id)}
                    className={`relative p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition ${selectedLeadId === t.id ? 'bg-blue-600/10 border-l-2 border-l-blue-500' : ''}`}
                >
                    <div className="flex justify-between items-start mb-1">
                        <span className={`font-bold text-sm flex items-center gap-1 ${t.has_unread ? 'text-white' : 'text-gray-300'}`}>
                            {t.name} {t.surname}
                            {/* LOCK ICON */}
                            {t.assigned_to !== currentUser.id && 
                             !(t.assigned_to === null && (currentUser.role === 'admin' || currentUser.role === 'manager')) && 
                             <Lock size={10} className="text-gray-500" />
                            }
                        </span>
                        <span className="text-[10px] text-gray-500">{new Date(t.last_message?.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                        <p className={`text-xs truncate max-w-45 ${t.has_unread ? 'text-white font-medium' : 'text-gray-500'}`}>
                            {t.last_message?.type === 'image' ? '📷 Image' : t.last_message?.message_text}
                        </p>
                        
                        {t.has_unread && (
                            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                        )}
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* --- CHAT WINDOW --- */}
      <div className="flex-1 flex flex-col bg-[#0b0e11] relative">
        {selectedLeadId ? (
            <>
                {/* Header */}
                <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#111827] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-lg text-white">
                            {currentThread?.name.substring(0,1).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-bold text-white flex items-center gap-2">
                                {currentThread?.name} {currentThread?.surname}
                                {isReadOnly && <span className="text-[10px] bg-gray-700 px-2 py-0.5 rounded text-gray-300">Read Only</span>}
                            </h3>
                            <p className="text-xs text-gray-400">{currentThread?.email}</p>
                        </div>
                    </div>
                </div>

                {/* Messages Area */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-linear-to-b from-[#0b0e11] to-[#111827]">
                    {messages.map((msg) => {
                        // --- IDENTIFY SENDER ---
                        const isClient = currentThread 
                            ? msg.sender_id === currentThread.trading_account_id 
                            : false;
                        
                        // Right Side = Any Support Staff (Me, Admin, Other Agent)
                        const isSupport = !isClient; 
                        const isMe = msg.sender_id === currentUser.id;

                        // --- DISPLAY NAME LOGIC ---
                        let displayName = 'Client';
                        
                        if (isClient) {
                            displayName = currentThread ? `${currentThread.name} ${currentThread.surname}` : 'Client';
                        } else {
                            // It's Support
                            if (isMe) {
                                displayName = currentUser.name || 'Me';
                            } else {
                                // It's a Colleague - USE SAVED NAME FROM DB
                                displayName = msg.sender_name || 'Support Team';
                            }
                        }

                        return (
                            <div key={msg.id} className={`flex flex-col ${isSupport ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                                {/* FIXED CSS: Added 'overflow-hidden' */}
                                <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm shadow-md overflow-hidden ${
                                    isSupport 
                                        ? 'bg-blue-600 text-white rounded-br-none' // Right Side (Blue)
                                        : 'bg-[#1f2937] text-gray-200 rounded-bl-none border border-white/5' // Left Side
                                }`}>
                                    <span className={`block text-[10px] font-bold mb-1 uppercase tracking-wide opacity-80 ${isSupport ? 'text-blue-100 text-right' : 'text-blue-400 text-left'}`}>
                                        {displayName}
                                    </span>
                                    
                                    {/* MESSAGE CONTENT */}
                                    {msg.type === 'image' ? (
                                        <div className="mt-1">
                                            <img 
                                                src={msg.message_text} 
                                                alt="attachment" 
                                                onClick={() => setFullScreenImage(msg.message_text)}
                                                className="max-w-62.5 max-h-50 object-cover rounded-lg border border-white/10 hover:opacity-90 transition cursor-zoom-in"
                                            />
                                        </div>
                                    ) : (
                                        // FIXED CSS: Added 'break-words' and removed 'wrap-break-word' (typo)
                                        <p className="whitespace-pre-wrap break-all">{msg.message_text}</p>
                                    )}
                                </div>
                                <span className="text-[10px] text-gray-600 mt-1 px-1 opacity-60">
                                    {new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* EMOJI PICKER */}
                {showEmoji && !isReadOnly && (
                    <div className="absolute bottom-20 right-6 z-50 animate-in zoom-in-95 duration-200">
                        <div className="fixed inset-0 z-40" onClick={() => setShowEmoji(false)} />
                        <div className="relative z-50">
                             <EmojiPicker 
                                onEmojiClick={onEmojiClick} 
                                theme={Theme.DARK} 
                                width={300} 
                                height={400} 
                             />
                        </div>
                    </div>
                )}

                {/* PREVIEW AREA */}
                {previewUrl && (
                    <div className="px-4 pb-2 bg-[#111827] flex items-center gap-2 animate-in slide-in-from-bottom-2">
                        <div className="relative group">
                            <img src={previewUrl} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-white/20" />
                            <button 
                                onClick={() => { setPreviewFile(null); setPreviewUrl(null); }}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:scale-110 transition"
                            >
                                <X size={12} />
                            </button>
                        </div>
                        <div className="text-xs text-gray-400">
                            <p className="font-bold text-white">Image attached</p>
                            <p>Ready to send...</p>
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <form className="p-4 border-t border-white/10 bg-[#111827] flex items-end gap-3 shrink-0">
                    
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileUpload}
                    />

                    {/* UPLOAD BUTTON (Disabled if ReadOnly) */}
                    <button 
                        type="button"
                        disabled={uploading || isReadOnly} 
                        onClick={() => fileInputRef.current?.click()}
                        className={`p-3 rounded-xl transition h-11.5 w-11.5 flex items-center justify-center ${isReadOnly ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-[#1f2937] hover:bg-[#374151] text-gray-400 hover:text-white'}`}
                    >
                         {uploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
                    </button>

                    <div className="flex-1 relative">
                        <textarea 
                            className={`w-full border rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none transition shadow-inner resize-none custom-scrollbar ${isReadOnly ? 'bg-gray-900 border-gray-800 text-gray-500 cursor-not-allowed' : 'bg-[#1f2937] border-white/10 text-white focus:border-blue-500 placeholder:text-gray-600'}`}
                            placeholder={isReadOnly ? "Chat disabled (Unassigned Lead)" : "Type your reply... (Shift+Enter for new line)"}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isReadOnly}
                            rows={1}
                            style={{ minHeight: '46px', maxHeight: '150px' }}
                        />
                        
                        <button 
                            type="button"
                            onClick={() => setShowEmoji(!showEmoji)}
                            disabled={isReadOnly}
                            className={`absolute right-3 bottom-3 transition ${isReadOnly ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-yellow-400'}`}
                        >
                            <Smile size={20} />
                        </button>
                    </div>

                    {/* SEND BUTTON (Disabled if ReadOnly) */}
                    <button 
                        onClick={(e) => handleSend(e)}
                        disabled={sending || (!replyText.trim() && !uploading) || isReadOnly}
                        className={`p-3 rounded-xl transition shadow-lg h-11.5 w-11.5 flex items-center justify-center ${isReadOnly ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20 active:scale-95'}`}
                    >
                        {sending ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                    </button>
                </form>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-[#0b0e11]">
                <div className="w-20 h-20 bg-[#1f2937] rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <MessageCircle size={40} className="text-gray-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-400 mb-2">Support Center</h3>
                <p className="text-sm text-gray-600">Select a conversation to start messaging</p>
            </div>
        )}
      </div>

      {/* --- LIGHTBOX --- */}
      {fullScreenImage && (
          <div 
             className="fixed inset-0 z-100 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" 
             onClick={() => setFullScreenImage(null)}
          >
              <button 
                onClick={() => setFullScreenImage(null)} 
                className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/50 rounded-full p-2 transition"
              >
                <X size={32} />
              </button>
              <img 
                src={fullScreenImage} 
                alt="Full Size" 
                className="max-w-full max-h-full rounded-md shadow-2xl animate-in zoom-in-95 duration-200" 
                onClick={(e) => e.stopPropagation()} 
              />
          </div>
      )}
    </div>
  );
}