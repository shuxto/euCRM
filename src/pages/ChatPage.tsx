import { ChatProvider, useChatContext } from '../context/ChatContext';
import ChatSidebar from '../components/Chat/ChatSidebar';
import ChatWindow from '../components/Chat/ChatWindow';
import MessageInput from '../components/Chat/MessageInput';
import { Hash, Lock, Users } from 'lucide-react';

// Inner Component to consume Context
function ChatLayout() {
  const { messages, currentUser, isLoading, sendMessage, activeRoom, rooms } = useChatContext();
  
  // Find current room name
  const currentRoom = rooms.find(r => r.id === activeRoom);

  const getHeaderIcon = () => {
    if (!currentRoom) return <Hash className="text-gray-500" />;
    if (currentRoom.type === 'global') return <Hash className="text-blue-400" />;
    if (currentRoom.type === 'department') return <Lock className="text-yellow-500" />;
    return <Users className="text-indigo-400" />;
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex gap-4">
      {/* 1. SIDEBAR (Navigation) */}
      <ChatSidebar />

      {/* 2. MAIN AREA */}
      <div className="flex-1 bg-black/40 border border-white/10 rounded-3xl flex flex-col overflow-hidden relative shadow-2xl">
        
        {/* Header */}
        <div className="h-16 border-b border-white/5 flex items-center px-6 bg-white/5 justify-between shrink-0">
            <div className="flex items-center gap-3">
                {getHeaderIcon()}
                <div>
                    <h3 className="text-lg font-bold text-white">{currentRoom?.name || 'Select a Room'}</h3>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1">
                         {activeRoom ? 'Active' : 'Offline'}
                    </p>
                </div>
            </div>
        </div>

        {/* Messages Display */}
        <ChatWindow 
            messages={messages} 
            currentUserId={currentUser?.id} 
            isLoading={isLoading} 
        />

        {/* Input Area (Files + Mentions) */}
        {activeRoom && (
            <MessageInput 
                onSendMessage={sendMessage} 
                isLoading={isLoading} 
            />
        )}
      </div>
    </div>
  );
}

// WRAPPER: Provides the "Brain" to the page
export default function ChatPage() {
  return (
    <ChatProvider>
        <ChatLayout />
    </ChatProvider>
  );
}