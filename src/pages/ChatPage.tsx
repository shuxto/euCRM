import React from 'react';
import ChatSidebar from '../components/Chat/ChatSidebar';
import ChatWindow from '../components/Chat/ChatWindow';
import MessageInput from '../components/Chat/MessageInput';
import { ChatProvider, useChatContext } from '../context/ChatContext';

// Inner Component to consume Context
function ChatLayout() {
  const { sendMessage, isLoading, activeRoom } = useChatContext();

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-black/40 backdrop-blur-sm rounded-xl overflow-hidden border border-white/10">
      
      {/* 1. SIDEBAR */}
      <ChatSidebar />

      {/* 2. MAIN AREA */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        
        {/* Messages Display (Now handles its own Header & Data) */}
        <ChatWindow />

        {/* Input Area - Only show if room is active */}
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

export default function ChatPage() {
  return (
    <ChatProvider>
        <ChatLayout />
    </ChatProvider>
  );
}