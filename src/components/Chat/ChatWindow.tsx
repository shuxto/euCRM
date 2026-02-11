import { useRef, useEffect } from 'react';
// FIX: Added 'type' keyword
import type { ChatMessage } from '../../types/chat';
import { Loader2, FileText, Download } from 'lucide-react';

interface ChatWindowProps {
  messages: ChatMessage[];
  currentUserId: string;
  isLoading: boolean;
}

export default function ChatWindow({ messages, currentUserId, isLoading }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const renderAttachments = (attachments: string[]) => {
    if (!attachments || attachments.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {attachments.map((url, i) => {
          const isImage = url.match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i);
          
          if (isImage) {
            return (
              <a 
                key={i} 
                href={url} 
                target="_blank" 
                rel="noreferrer" 
                className="block w-48 h-32 rounded-lg overflow-hidden border border-white/10 hover:opacity-80 transition shadow-sm"
              >
                <img src={url} alt="attachment" className="w-full h-full object-cover" />
              </a>
            );
          }
          
          return (
            <a 
              key={i} 
              href={url} 
              target="_blank" 
              rel="noreferrer" 
              className="flex items-center gap-2 bg-black/20 p-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition group"
            >
               <div className="p-1.5 bg-blue-500/10 rounded text-blue-400">
                  <FileText size={16} />
               </div>
               <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">File Attachment</span>
                  {/* FIX: Changed max-w-[100px] to max-w-25 */}
                  <span className="text-xs text-gray-200 truncate max-w-25">Download</span>
               </div>
               <Download size={14} className="text-gray-500 group-hover:text-white ml-2 transition" />
            </a>
          );
        })}
      </div>
    );
  };

  if (isLoading && messages.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <p className="text-xs text-gray-500 animate-pulse">Loading encrypted history...</p>
        </div>
      );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
      
      {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
             <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                 <FileText size={24} />
             </div>
             <p className="text-sm italic">No messages yet. Break the ice!</p>
          </div>
      )}

      {messages.map((msg, index) => {
        const isMe = msg.sender_id === currentUserId;
        const showAvatar = index === 0 || messages[index - 1].sender_id !== msg.sender_id;
        
        return (
          <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            
            <div className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg overflow-hidden border border-white/5 ${!showAvatar ? 'opacity-0' : ''} ${isMe ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]' : 'bg-gray-700'}`}>
               {msg.sender?.avatar_url ? (
                   <img src={msg.sender.avatar_url} className="w-full h-full object-cover" />
               ) : (
                   <span className="text-xs font-bold text-white">{msg.sender?.real_name?.[0]?.toUpperCase() || '?'}</span>
               )}
            </div>

            <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
               {showAvatar && !isMe && <span className="text-[10px] text-gray-400 ml-1 mb-1 font-medium">{msg.sender?.real_name}</span>}
               
               <div className={`
                 px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-md
                 ${isMe 
                    ? 'bg-indigo-600 text-white rounded-tr-none border border-indigo-500' 
                    : 'bg-[#1e293b] text-gray-200 rounded-tl-none border border-white/10'
                 }
               `}>
                 {msg.content}
                 {renderAttachments(msg.attachments || [])}
               </div>
               
               <span className="text-[9px] text-gray-600 mt-1 px-1 opacity-60">
                 {new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
               </span>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}