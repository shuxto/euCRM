import { useState, useEffect, useRef, useLayoutEffect, useMemo, memo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Send, Users, Hash, Smile, Search, Loader2 } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react'; 
import { useChat } from '../hooks/useChat';
import { GLOBAL_CHAT_ID } from '../constants';

// --- OPTIMIZATION: Memoized Sidebar Item ---
const SidebarItem = memo(({ user, isActive, onClick }: { user: any, isActive: boolean, onClick: (id: string, name: string) => void }) => {
    return (
        <div 
            onClick={() => onClick(user.id, user.real_name)}
            className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer group transition-colors ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
        >
            {/* UPDATED: AVATAR DISPLAY */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white transition-colors overflow-hidden ${isActive ? 'bg-blue-600' : 'bg-gray-700 group-hover:bg-blue-500'}`}>
                {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.real_name} className="w-full h-full object-cover" />
                ) : (
                    user.real_name.substring(0,2).toUpperCase()
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate transition-colors ${isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                    {user.real_name}
                </p>
                <p className="text-[10px] text-gray-600 truncate capitalize">{user.role}</p>
            </div>
        </div>
    );
}, (prev, next) => prev.isActive === next.isActive && prev.user.id === next.user.id);

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeRoom, setActiveRoom] = useState<string>(GLOBAL_CHAT_ID); 
  const [activeRoomName, setActiveRoomName] = useState('Global Headquarters');
  
  const [isSwitching, setIsSwitching] = useState(false);

  // The hook is optimized, so we just consume the data
  const { messages, loading, sendMessage, isSending, loadMore, hasMore } = useChat(activeRoom, currentUser?.id);

  const [users, setUsers] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  
  const [showTagList, setShowTagList] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0); 
  const [userSearch, setUserSearch] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null); 
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevMessagesLength = useRef(0);

  // --- SMART SCROLL LOGIC ---
  useLayoutEffect(() => {
    if (isSwitching) return; 
    const container = scrollContainerRef.current;
    if (!container) return;

    const currentLen = messages.length;
    const prevLen = prevMessagesLength.current;

    if (prevLen === 0 && currentLen > 0) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
    else if (currentLen > prevLen && (currentLen - prevLen) < 5) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
        const lastMsg = messages[messages.length - 1];
        const isMe = lastMsg?.sender_id === currentUser?.id;

        if (isNearBottom || isMe) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    prevMessagesLength.current = currentLen;
  }, [messages, currentUser, isSwitching]);

  const markAsRead = async (roomId: string) => {
    if (!currentUser) return;
    try {
        await supabase
        .from('crm_messages')
        .update({ read: true })
        .eq('room_id', roomId)
        .neq('sender_id', currentUser.id)
        .eq('read', false);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    if (activeRoom && currentUser && !isSwitching) markAsRead(activeRoom);
  }, [activeRoom, messages.length, currentUser, isSwitching]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user));
    // UPDATED: Added avatar_url to fetch
    supabase.from('crm_users').select('id, real_name, role, avatar_url').order('real_name')
      .then(({ data }) => { if(data) setUsers(data); });

    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room_id');
    if (roomId) setActiveRoom(roomId);
  }, []);

  useEffect(() => {
      const url = new URL(window.location.href);
      if (activeRoom === GLOBAL_CHAT_ID) {
          url.searchParams.delete('room_id');
      } else {
          url.searchParams.set('room_id', activeRoom);
      }
      window.history.replaceState({}, '', url);
  }, [activeRoom]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setNewMessage(val);
      if (activeRoom !== GLOBAL_CHAT_ID) {
          setShowTagList(false);
          return;
      }
      const selectionStart = e.target.selectionStart;
      setCursorPosition(selectionStart);
      const lastAt = val.lastIndexOf('@', selectionStart);
      if (lastAt !== -1) {
          const query = val.substring(lastAt + 1, selectionStart);
          if (!query.includes(' ')) {
              setTagQuery(query);
              setShowTagList(true);
              return;
          }
      }
      setShowTagList(false);
  };

  const addTag = (user: any) => {
      const lastAt = newMessage.lastIndexOf('@', cursorPosition);
      const prefix = newMessage.substring(0, lastAt);
      const suffix = newMessage.substring(cursorPosition);
      const inserted = `@${user.real_name} `;
      setNewMessage(`${prefix}${inserted}${suffix}`);
      setMentionIds(prev => [...prev, user.id]);
      setShowTagList(false);
      if(inputRef.current) inputRef.current.focus();
  };

  // --- OPTIMIZED SWITCHING LOGIC ---
  const startDM = useCallback(async (otherUserId: string, otherUserName: string) => {
    setIsSwitching(true);
    setActiveRoomName(otherUserName);

    try {
        const { data, error } = await supabase.rpc('create_or_get_dm_room', { other_user_id: otherUserId });
        if(error) throw error;
        
        setActiveRoom(data);
    } catch (err) {
        console.error("DM Error:", err);
    } finally {
        setIsSwitching(false);
    }
  }, []);
  
  const openGlobal = useCallback(() => {
      setIsSwitching(true);
      setActiveRoomName('Global Headquarters');
      setActiveRoom(GLOBAL_CHAT_ID);
      setTimeout(() => setIsSwitching(false), 50);
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim()) return;
    await sendMessage(newMessage, mentionIds);
    setNewMessage('');
    setMentionIds([]);
    setShowPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
  };

  const renderMessageContent = (content: string) => {
      if (!content) return null;
      const parts = content.split(/(@[\w\s]+)/g);
      return parts.map((part, index) => {
          if (part.startsWith('@')) {
              return (
                  <span key={index} className="inline-block bg-blue-500/20 text-blue-300 px-1.5 rounded mx-0.5 text-xs font-bold border border-blue-500/30">
                      {part}
                  </span>
              );
          }
          return part;
      });
  };

  const filteredTags = useMemo(() => 
    users.filter(u => u.real_name.toLowerCase().startsWith(tagQuery.toLowerCase())),
    [users, tagQuery]
  );

  const filteredUsers = useMemo(() => 
    users.filter(u => u.id !== currentUser?.id && u.real_name.toLowerCase().includes(userSearch.toLowerCase())),
    [users, currentUser?.id, userSearch]
  );

  // --- MEMOIZED MESSAGE LIST ---
  const messagesList = useMemo(() => {
    if (isSwitching || (loading && messages.length === 0)) {
        return (
            <div className="flex-1 p-6 space-y-4 overflow-hidden">
                <div className="flex items-start gap-3 animate-pulse">
                    <div className="w-8 h-8 bg-white/5 rounded-lg"></div>
                    <div className="h-10 w-48 bg-white/5 rounded-xl"></div>
                </div>
                <div className="flex items-start gap-3 flex-row-reverse animate-pulse">
                      <div className="w-8 h-8 bg-white/5 rounded-lg"></div>
                      <div className="h-12 w-64 bg-white/5 rounded-xl"></div>
                </div>
                 <div className="flex items-start gap-3 animate-pulse">
                    <div className="w-8 h-8 bg-white/5 rounded-lg"></div>
                    <div className="h-8 w-32 bg-white/5 rounded-xl"></div>
                </div>
            </div>
        );
    }

    return (
        <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"
        >
            {hasMore && (
                <div className="flex justify-center pb-4">
                    <button 
                        onClick={loadMore}
                        disabled={loading}
                        className="text-[10px] font-bold uppercase tracking-widest text-blue-400 bg-blue-500/5 border border-blue-500/20 px-4 py-2 rounded-full hover:bg-blue-500/10 transition flex items-center gap-2"
                    >
                        {loading && <Loader2 size={12} className="animate-spin" />}
                        Load Earlier Messages
                    </button>
                </div>
            )}
            {messages.map((msg, i) => {
                const isMe = msg.sender_id === currentUser?.id;
                const showAvatar = i === 0 || messages[i-1].sender_id !== msg.sender_id;
                const isMentioned = msg.mentions && msg.mentions.includes(currentUser?.id);

                return (
                    <div key={msg.id} className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`flex gap-3 max-w-[70%] ${isMe ? 'flex-row-reverse' : ''}`}>
                            {/* UPDATED: AVATAR LOGIC */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold overflow-hidden ${isMe ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-300'} ${!showAvatar ? 'opacity-0' : ''}`}>
                                {msg.sender?.avatar_url ? (
                                    <img src={msg.sender.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    msg.sender?.real_name?.substring(0,2).toUpperCase()
                                )}
                            </div>
                            <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                {showAvatar && !isMe && <span className="text-[10px] text-gray-400 ml-1 mb-1">{msg.sender?.real_name}</span>}
                                <div className={`
                                    px-4 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                                    ${isMe 
                                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                                        : (isMentioned 
                                            ? 'bg-yellow-500/20 border border-yellow-500 text-yellow-100 rounded-tl-none shadow-[0_0_15px_rgba(234,179,8,0.3)]' 
                                            : 'bg-[#1e293b] text-gray-200 rounded-tl-none border border-white/5')
                                    }
                                `}>
                                    {renderMessageContent(msg.content)}
                                </div>
                                <span className="text-[9px] text-gray-600 px-1 opacity-50 mt-1">
                                    {new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>
    );
  }, [messages, currentUser, loading, hasMore, loadMore, isSwitching]);

  return (
    <div className="h-[calc(100vh-2rem)] flex gap-4">
        {/* SIDEBAR */}
        <div className="w-72 bg-black/20 border border-white/5 rounded-3xl p-4 hidden md:flex flex-col">
            <h2 className="text-xl font-bold text-white mb-4 px-2">Chats</h2>
            <div 
                onClick={openGlobal}
                className={`p-3 mb-6 rounded-xl flex items-center gap-3 cursor-pointer transition ${activeRoom === GLOBAL_CHAT_ID ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
            >
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"><Hash size={20} /></div>
                <div>
                    <p className="font-bold text-sm">Global Chat</p>
                    <p className="text-[10px] opacity-70">Everyone</p>
                </div>
            </div>

            <div className="flex items-center justify-between px-2 mb-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Direct Messages</h3>
            </div>
            
            <div className="relative mb-2">
                <Search className="absolute left-3 top-2.5 text-gray-500" size={14} />
                <input 
                    type="text" 
                    placeholder="Search people..." 
                    className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-9 text-xs text-white focus:border-blue-500 outline-none"
                    onChange={(e) => setUserSearch(e.target.value)}
                />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                {filteredUsers.map(user => (
                    <SidebarItem 
                        key={user.id} 
                        user={user} 
                        isActive={activeRoomName === user.real_name} 
                        onClick={startDM} 
                    />
                ))}
            </div>
        </div>

        {/* CHAT AREA */}
        <div className="flex-1 bg-black/40 border border-white/10 rounded-3xl flex flex-col overflow-hidden relative shadow-2xl">
            <div className="h-16 border-b border-white/5 flex items-center px-6 bg-white/5 justify-between shrink-0">
                <div className="flex items-center gap-3">
                    {activeRoomName.includes('Global') ? <Hash className="text-blue-400" /> : <Users className="text-green-400" />}
                    <h3 className="text-lg font-bold text-white">{activeRoomName}</h3>
                </div>
            </div>

            {messagesList}

            <div className="p-4 bg-white/5 border-t border-white/5 relative">
                {showTagList && filteredTags.length > 0 && (
                    <div className="absolute bottom-20 left-14 bg-crm-bg/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] w-56 overflow-hidden z-50 animate-in slide-in-from-bottom-2">
                        <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-white/10">Suggestions</div>
                        {filteredTags.map(u => (
                            <div key={u.id} onClick={() => addTag(u)} className="px-3 py-2.5 hover:bg-blue-600 hover:text-white text-gray-300 text-xs cursor-pointer flex items-center gap-3 transition-colors border-b border-white/5 last:border-0">
                                {/* UPDATED: AVATAR IN MENTION LIST */}
                                <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center font-bold text-[10px] text-white border border-white/10 overflow-hidden">
                                     {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover"/> : u.real_name.substring(0,2).toUpperCase()}
                                </div>
                                <span className="font-medium">{u.real_name}</span>
                            </div>
                        ))}
                    </div>
                )}
                {showPicker && (
                    <div className="absolute bottom-20 left-4 z-50 animate-in zoom-in-95">
                        <EmojiPicker onEmojiClick={(e) => setNewMessage(prev => prev + e.emoji)} theme={Theme.DARK} width={300} height={400} />
                    </div>
                )}
                <form className="relative flex gap-2 items-end z-20">
                    <button type="button" onClick={() => setShowPicker(!showPicker)} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-yellow-400 transition"><Smile size={20} /></button>
                    <textarea ref={inputRef} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-white focus:border-indigo-500 outline-none transition shadow-inner resize-none custom-scrollbar" placeholder={`Message ${activeRoomName}...`} value={newMessage} onChange={handleInputChange} onKeyDown={handleKeyDown} rows={1} style={{ minHeight: '46px', maxHeight: '120px' }} />
                    <button onClick={handleSend} disabled={isSending || !newMessage.trim()} className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl transition shadow-lg shadow-indigo-500/20">
                        {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                </form>
            </div>
        </div>
    </div>
  );
}