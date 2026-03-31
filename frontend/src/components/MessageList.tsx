import { useEffect, useRef } from 'react';
import type { Message } from '../types/index.js';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface MessageListProps {
  messages: Message[];
  conversationId: string;
  isTyping?: boolean;
}

export function MessageList({ messages, conversationId, isTyping }: MessageListProps) {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let currentDate = '';

  messages.forEach((message) => {
    const messageDate = formatDate(message.created_at);
    if (messageDate !== currentDate) {
      currentDate = messageDate;
      groupedMessages.push({ date: messageDate, messages: [message] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(message);
    }
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-scroll" style={{ maxHeight: 'calc(100vh - 200px)' }}>
      {groupedMessages.map((group, groupIndex) => (
        <div key={groupIndex}>
          {/* Date separator */}
          <div className="flex justify-center mb-4">
            <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {group.date}
            </span>
          </div>

          {/* Messages */}
          <div className="space-y-2">
            {group.messages.map((message) => {
              const isOwn = message.sender_id === user?.id;

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-end gap-2 max-w-xs sm:max-w-md lg:max-w-lg ${isOwn ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    {!isOwn && message.sender_picture && (
                      <img
                        src={message.sender_picture}
                        alt={message.sender_name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    )}
                    {!isOwn && !message.sender_picture && (
                      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-sm font-medium">
                        {message.sender_name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}

                    {/* Message bubble */}
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isOwn
                          ? 'bg-blue-500 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                      }`}
                    >
                      {message.message_type === 'image' && message.media_url ? (
                        <div className="space-y-2">
                          <img
                            src={`${API_URL}${message.media_url}`}
                            alt="Shared image"
                            className="rounded-lg max-w-full"
                          />
                          {message.content && <p>{message.content}</p>}
                        </div>
                      ) : (
                        <p className="break-words">{message.content}</p>
                      )}
                      <span
                        className={`text-xs mt-1 block ${
                          isOwn ? 'text-blue-100' : 'text-gray-500'
                        }`}
                      >
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Typing indicator */}
      {isTyping && (
        <div className="flex justify-start">
          <div className="flex items-end gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-300" />
            <div className="px-4 py-2 bg-gray-100 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
