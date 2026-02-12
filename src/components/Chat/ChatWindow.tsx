import { useRef, useState, useLayoutEffect } from 'react';
import { useChatContext } from '../../context/ChatContext';
import { Loader2, ArrowUp, FileText, Download } from 'lucide-react';

export default function ChatWindow() {
  const { messages, isLoading, currentUser, activeRoom, rooms, loadMoreMessages, hasMore } = useChatContext();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // New Ref for container
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Track previous state to determine scroll behavior
  const prevMessagesLength = useRef(0);
  const prevRoomId = useRef<string | null>(null);

  useLayoutEffect(() => {
    // Case 1: Room Switched -> Instant jump to bottom
    if (activeRoom !== prevRoomId.current) {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'auto' });
        }
        prevRoomId.current = activeRoom;
        prevMessagesLength.current = messages.length;
        return;
    }

    // Case 2: Messages Added
    if (messages.length > prevMessagesLength.current) {
        const isLoadOlder = loadingMore; 
        const isInitialLoad = prevMessagesLength.current === 0; // Check if this is the first batch

        if (isLoadOlder) {
            // Maintain position (TODO: Precise calc if needed)
        } else {
             // New Message -> Smooth scroll ONLY if not initial load
             if (bottomRef.current) {
                bottomRef.current.scrollIntoView({ 
                    behavior: isInitialLoad ? 'auto' : 'smooth' 
                });
            }
        }
    }

    prevMessagesLength.current = messages.length;
  }, [messages, activeRoom, loadingMore]);

  const handleLoadMore = async () => {
      setLoadingMore(true);
      
      // Capture current scroll height before loading
      const container = containerRef.current;
      const oldScrollHeight = container ? container.scrollHeight : 0;
      const oldScrollTop = container ? container.scrollTop : 0;

      await loadMoreMessages();
      
      // Restore position logic would go here if we used useLayoutEffect depending on re-render timing
      // For simplified "don't jump to bottom", the effect above handles the "don't scroll" part.
      // To keep visual position, we might need to adjust scrollTop after render.
      requestAnimationFrame(() => {
          if (container) {
              const newScrollHeight = container.scrollHeight;
              const heightDiff = newScrollHeight - oldScrollHeight;
              container.scrollTop = oldScrollTop + heightDiff;
          }
      });

      setLoadingMore(false);
  };

  const formatTime = (dateString: string) => {
      return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
  
  const getFileName = (url: string) => {
      try { return decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'File'); } 
      catch { return 'File'; }
  };

  if (!activeRoom) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black/40 text-gray-500">
        <p>Select a room to start chatting</p>
      </div>
    );
  }

  const currentRoom = rooms.find(r => r.id === activeRoom);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black/20">
      <div className="h-14 border-b border-white/5 flex items-center px-6 justify-between bg-black/40">
        <div>
            <h2 className="text-white font-bold">{currentRoom?.name || 'Chat'}</h2>
            <p className="text-[10px] text-gray-400">
                {currentRoom?.type === 'dm' ? 'Direct Message' : 'Secure Channel'}
            </p>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
        
        {hasMore && (
            <div className="flex justify-center py-2">
                <button 
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs text-blue-400 transition-colors"
                >
                    {loadingMore ? <Loader2 className="animate-spin" size={12} /> : <ArrowUp size={12} />}
                    Load Older Messages
                </button>
            </div>
        )}

        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        ) : (
          messages.map((msg, index) => {
            // LOGIC CHECK: Are we the sender?
            const isMe = currentUser && msg.sender_id === currentUser.id;
            
            // FIXED: Removed '!isMe' so YOU can see your own avatar too
            const showAvatar = index === 0 || messages[index - 1].sender_id !== msg.sender_id;
            
            // FIXED: Removed '!isMe' so YOU can see your own name too
            const showName = showAvatar; 

            return (
              <div key={msg.id} className={`flex gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                
                {/* LEFT AVATAR (OTHERS) */}
                {!isMe && (
                  <div className="w-8 shrink-0 flex flex-col items-center">
                    {showAvatar ? (
                      <div className="w-8 h-8 rounded-full bg-gray-700 border border-white/10 overflow-hidden flex items-center justify-center">
                         {msg.sender?.avatar_url ? (
                            <img src={msg.sender.avatar_url} className="w-full h-full object-cover" />
                         ) : (
                            <span className="text-[10px] font-bold text-white">
                                {(msg.sender?.real_name || '?')[0]}
                            </span>
                         )}
                      </div>
                    ) : <div className="w-8" />} 
                  </div>
                )}

                {/* MESSAGE COLUMN */}
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%]`}>
                    
                    {/* SENDER NAME (Now shows for everyone) */}
                    {showName && (
                        <span className={`text-[10px] text-gray-400 mb-1 ${isMe ? 'mr-1' : 'ml-1'}`}>
                            {msg.sender?.real_name || 'Unknown User'}
                        </span>
                    )}

                    {/* BUBBLE */}
                    <div className={`p-3 rounded-2xl text-sm ${
                        isMe 
                        ? 'bg-blue-600 text-white rounded-tr-sm' 
                        : 'bg-white/10 text-gray-200 rounded-tl-sm'
                    }`}>
                        
                        {/* ATTACHMENTS */}
                        {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-2">
                                {msg.attachments.map((url, i) => {
                                    if (isImage(url)) {
                                        return (
                                            <a key={i} href={url} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-lg border border-black/20">
                                                <img src={url} className="w-32 h-32 object-cover transition-transform duration-300 group-hover:scale-110" />
                                            </a>
                                        );
                                    } else {
                                        return (
                                            <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-2 bg-black/20 rounded-lg border border-white/10 hover:bg-black/40 transition-colors min-w-40">
                                                <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center shrink-0">
                                                    <FileText size={16} className="text-blue-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium truncate text-white">{getFileName(url)}</p>
                                                </div>
                                                <Download size={14} className="text-gray-500" />
                                            </a>
                                        );
                                    }
                                })}
                            </div>
                        )}
                        
                        {/* TEXT */}
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    
                    {/* TIME */}
                    <span className="text-[9px] text-gray-500 mt-1 px-1">
                        {formatTime(msg.created_at)}
                    </span>
                </div>

                {/* RIGHT AVATAR (ME) - Added this block */}
                {isMe && (
                  <div className="w-8 shrink-0 flex flex-col items-center">
                    {showAvatar ? (
                      <div className="w-8 h-8 rounded-full bg-blue-600 border border-white/10 overflow-hidden flex items-center justify-center">
                         {msg.sender?.avatar_url ? (
                            <img src={msg.sender.avatar_url} className="w-full h-full object-cover" />
                         ) : (
                            <span className="text-[10px] font-bold text-white">
                                {(msg.sender?.real_name || '?')[0]}
                            </span>
                         )}
                      </div>
                    ) : <div className="w-8" />} 
                  </div>
                )}

              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}