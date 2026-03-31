import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import type { Contact, Conversation, Message } from '../types/index.js';
import { contactsApi, conversationsApi, uploadApi } from '../lib/api';
import { ContactList } from '../components/ContactList';
import { MessageList } from '../components/MessageList';
import { MessageInput } from '../components/MessageInput';

export function ChatPage() {
  const { user, logout } = useAuth();
  const { socket, sendMessage, joinConversation, leaveConversation } = useSocket();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showMobileContacts, setShowMobileContacts] = useState(true);

  // Load contacts
  useEffect(() => {
    contactsApi.getAll().then((res) => setContacts(res.data)).catch(console.error);
  }, []);

  // Listen for socket events
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: Message) => {
      // Only add messages from other users (sender's own messages are added via handleSendMessage)
      if (message.conversation_id === conversation?.id && message.sender_id !== user?.id) {
        setMessages((prev) => [...prev, message]);
      }
    };

    const handleTypingStarted = ({ userId }: { userId: string }) => {
      // Only show typing if it's the other person in the conversation
      if (conversation) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 3000);
      }
    };

    const handleTypingStopped = () => {
      setIsTyping(false);
    };

    const handleContactAccepted = () => {
      // Refresh contacts when a pending request is accepted
      refreshContacts();
    };

    socket.on('message:new', handleNewMessage);
    socket.on('typing:started', handleTypingStarted);
    socket.on('typing:stopped', handleTypingStopped);
    socket.on('contact:accepted', handleContactAccepted);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('typing:started', handleTypingStarted);
      socket.off('typing:stopped', handleTypingStopped);
      socket.off('contact:accepted', handleContactAccepted);
    };
  }, [conversation, socket, refreshContacts]);

  const refreshContacts = useCallback(() => {
    contactsApi.getAll().then((res) => setContacts(res.data)).catch(console.error);
  }, []);

  const handleSelectContact = useCallback(async (contact: Contact) => {
    setSelectedContact(contact);
    setShowMobileContacts(false);

    try {
      const res = await conversationsApi.getOrCreateDirect(contact.contact_email);
      const newConversation = { ...res.data, other_user_email: contact.contact_email, other_user_name: contact.contact_name, other_user_picture: contact.contact_picture };
      setConversation(newConversation);
      setMessages(newConversation.messages || []);
      joinConversation(newConversation.id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  }, [joinConversation]);

  const handleAddContact = useCallback(async (email: string) => {
    try {
      const res = await contactsApi.add(email);
      setContacts((prev) => [...prev, res.data]);
      refreshContacts();
      return { success: true };
    } catch (error: any) {
      console.error('Failed to add contact:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to add contact' };
    }
  }, [refreshContacts]);

  const handleInviteContact = useCallback((email: string) => {
    const subject = encodeURIComponent('Join me on Web Chat!');
    const body = encodeURIComponent(
      `Hey!\n\nI've been using this web chat app and it would be great to chat with you here.\n\nClick the link below to sign up:\n${window.location.origin}\n\nHope to see you there!`
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  }, []);

  const handleAcceptContact = useCallback(async (id: string) => {
    try {
      await contactsApi.accept(id);
      refreshContacts();
    } catch (error) {
      console.error('Failed to accept contact:', error);
    }
  }, [refreshContacts]);

  const handleDeleteContact = useCallback(async (id: string) => {
    try {
      await contactsApi.delete(id);
      refreshContacts();
    } catch (error) {
      console.error('Failed to delete contact:', error);
    }
  }, [refreshContacts]);

  const handleSendMessage = useCallback(async (content: string, messageType?: 'text' | 'image', mediaUrl?: string) => {
    if (!conversation) return;

    try {
      const message = await sendMessage(conversation.id, content, messageType, mediaUrl);
      setMessages((prev) => [...prev, message]);
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    }
  }, [conversation, sendMessage]);

  const handleUploadImage = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setIsUploading(true);

      try {
        // Upload image directly
        const { data } = await uploadApi.uploadImage(file);

        // Send message with image (empty content)
        await handleSendMessage('', 'image', data.imageUrl);
      } catch (error) {
        console.error('Failed to upload image:', error);
        alert('Failed to upload image. Please try again.');
      } finally {
        setIsUploading(false);
      }
    };

    input.click();
  }, [handleSendMessage]);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMobileContacts(!showMobileContacts)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            {selectedContact?.contact_picture ? (
              <img
                src={selectedContact.contact_picture}
                alt={selectedContact.contact_name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                {selectedContact?.contact_name?.[0]?.toUpperCase() || selectedContact?.contact_email[0].toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-semibold text-gray-900">
                {selectedContact?.contact_name || selectedContact?.contact_email || 'Select a contact'}
              </h1>
              {isTyping && <p className="text-sm text-gray-500">typing...</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user?.picture && (
            <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
          )}
          <button
            onClick={logout}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
            title="Logout"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Contacts sidebar */}
        <div
          className={`${
            showMobileContacts ? 'block' : 'hidden'
          } lg:block w-full lg:w-80 border-r border-gray-200 bg-white`}
        >
          <ContactList
            contacts={contacts}
            onSelectContact={handleSelectContact}
            onAddContact={handleAddContact}
            onAcceptContact={handleAcceptContact}
            onDeleteContact={handleDeleteContact}
            onInviteContact={handleInviteContact}
          />
        </div>

        {/* Chat area */}
        <div className={`flex-1 flex flex-col ${!showMobileContacts ? 'block' : 'hidden lg:flex'}`}>
          {conversation ? (
            <>
              <MessageList messages={messages} conversationId={conversation.id} isTyping={isTyping} />
              <MessageInput
                conversationId={conversation.id}
                onSendMessage={handleSendMessage}
                isUploading={isUploading}
                onUploadImage={handleUploadImage}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-lg font-medium">Select a contact to start chatting</p>
                <p className="text-sm mt-2">Or add a new contact by email</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
