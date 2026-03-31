export type User = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  created_at: string;
};

export type Contact = {
  id: string;
  user_id: string;
  contact_email: string;
  contact_name?: string;
  contact_picture?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  direction?: 'incoming' | 'outgoing';
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name?: string;
  sender_picture?: string;
  content: string;
  message_type: 'text' | 'image';
  media_url?: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  type: 'direct' | 'group';
  other_user_email?: string;
  other_user_name?: string;
  other_user_picture?: string;
  created_at: string;
  updated_at: string;
};

export type ConversationWithMessages = Conversation & {
  messages: Message[];
};
