import { useState, useRef } from 'react'; // Removed useEffect
import { Send, Paperclip, X, Smile, Loader2 } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useChatContext } from '../../context/ChatContext'; // Changed import

interface MessageInputProps {
  onSendMessage: (text: string, files: File[], mentions: string[]) => Promise<void>;
  isLoading: boolean;
}

export default function MessageInput({ onSendMessage, isLoading }: MessageInputProps) {
  const { allUsers } = useChatContext(); // Get users from Brain
  
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  // Removed local [users, setUsers] state
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Removed useEffect (Fetching) - Logic moved to Context

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    const lastWord = val.split(' ').pop();
    if (lastWord && lastWord.startsWith('@') && lastWord.length > 1) {
      setMentionQuery(lastWord.substring(1));
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const addMention = (user: any) => {
    const words = text.split(' ');
    words.pop(); 
    const newText = words.join(' ') + ` @${user.real_name} `;
    setText(newText);
    setSelectedMentions(prev => [...prev, user.id]);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!text.trim() && files.length === 0) || isLoading) return;
    await onSendMessage(text, files, selectedMentions);
    setText('');
    setFiles([]);
    setSelectedMentions([]);
    setShowEmoji(false);
  };

  // Use 'allUsers' from context instead of local 'users'
  const filteredUsers = allUsers.filter(u => 
    u.real_name && u.real_name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  return (
    <div className="p-4 bg-white/5 border-t border-white/5 relative">
      
      {/* 1. FILE PREVIEWS */}
      {files.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-2 custom-scrollbar">
          {files.map((file, i) => (
            // FIX: Changed min-w-[80px] to min-w-20
            <div key={i} className="relative group min-w-20 w-20 h-20 bg-black/40 rounded-lg border border-white/10 flex items-center justify-center overflow-hidden">
              {file.type.startsWith('image/') ? (
                 <img src={URL.createObjectURL(file)} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition" />
              ) : (
                 <span className="text-[10px] text-gray-400 font-bold uppercase p-1 text-center">{file.name.split('.').pop()}</span>
              )}
              <button onClick={() => removeFile(i)} className="absolute top-1 right-1 bg-red-500/80 p-0.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 2. MENTION POPUP */}
      {showMentions && filteredUsers.length > 0 && (
        // FIX: Changed bg-[#0f172a] to bg-crm-bg
        <div className="absolute bottom-20 left-16 bg-crm-bg border border-white/20 rounded-xl shadow-2xl w-56 max-h-48 overflow-y-auto z-50 animate-in slide-in-from-bottom-2">
          <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase border-b border-white/10">Mention Someone</div>
          {filteredUsers.map(u => (
            <div key={u.id} onClick={() => addMention(u)} className="px-3 py-2 hover:bg-blue-600 hover:text-white cursor-pointer flex items-center gap-2 text-xs text-gray-300 transition-colors">
               <div className="w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden font-bold text-[9px]">
                 {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover"/> : u.real_name[0]}
               </div>
               {u.real_name}
            </div>
          ))}
        </div>
      )}

      {/* 3. EMOJI POPUP */}
      {showEmoji && (
        <div className="absolute bottom-20 left-4 z-50 animate-in zoom-in-95">
          <EmojiPicker theme={Theme.DARK} onEmojiClick={(e) => setText(prev => prev + e.emoji)} width={300} height={400} />
        </div>
      )}

      {/* 4. INPUT AREA */}
      <div className="flex gap-2 items-end">
        <input type="file" id="file-upload" multiple className="hidden" onChange={handleFileSelect} />
        
        <div className="flex flex-col gap-1">
            <button onClick={() => setShowEmoji(!showEmoji)} className="p-3 bg-white/5 hover:bg-white/10 hover:text-yellow-400 rounded-xl text-gray-400 transition"><Smile size={20}/></button>
            <button onClick={() => document.getElementById('file-upload')?.click()} className="p-3 bg-white/5 hover:bg-white/10 hover:text-blue-400 rounded-xl text-gray-400 transition"><Paperclip size={20}/></button>
        </div>

        <textarea 
          ref={inputRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (@ to mention)"
          className="flex-1 bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white outline-none focus:border-indigo-500 transition resize-none custom-scrollbar shadow-inner"
          rows={1}
          style={{ minHeight: '50px', maxHeight: '150px' }}
        />

        <button 
          onClick={handleSend}
          disabled={isLoading || (!text.trim() && files.length === 0)}
          className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          {isLoading ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}
        </button>
      </div>
    </div>
  );
}