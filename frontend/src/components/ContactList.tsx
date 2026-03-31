import { useState } from 'react';
import type { Contact } from '../types/index.js';
import { contactsApi } from '../lib/api.js';

interface ContactListProps {
  contacts: Contact[];
  onSelectContact: (contact: Contact) => void;
  onAddContact: (email: string) => Promise<{ success: boolean; error?: string }>;
  onAcceptContact: (id: string) => void;
  onDeleteContact: (id: string) => void;
  onInviteContact: (email: string) => void;
}

export function ContactList({
  contacts,
  onSelectContact,
  onAddContact,
  onAcceptContact,
  onDeleteContact,
  onInviteContact,
}: ContactListProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  // Separate contacts by direction and status
  const incomingRequests = contacts.filter((c) => c.direction === 'incoming' && c.status === 'pending');
  const outgoingRequests = contacts.filter((c) => c.direction === 'outgoing' && c.status === 'pending');
  const acceptedContacts = contacts.filter((c) => c.status === 'accepted');

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
          title="Add contact"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Add contact modal */}
        {showAddModal && (
          <AddContactModal
            onClose={() => setShowAddModal(false)}
            onAdd={onAddContact}
            onInvite={onInviteContact}
          />
        )}

        {/* Incoming requests (requests from others) */}
        {incomingRequests.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contact Requests ({incomingRequests.length})</h3>
            {incomingRequests.map((contact) => (
              <div
                key={contact.id}
                className="flex flex-col gap-2 p-3 bg-green-50 rounded-lg mb-2"
              >
                <div className="flex items-start gap-3">
                  {contact.contact_picture ? (
                    <img
                      src={contact.contact_picture}
                      alt={contact.contact_name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-medium flex-shrink-0">
                      {contact.contact_name?.[0]?.toUpperCase() || contact.contact_email[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {contact.contact_name || contact.contact_email}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{contact.contact_email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onAcceptContact(contact.id)}
                    className="flex-1 px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 font-medium"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onDeleteContact(contact.id)}
                    className="flex-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Outgoing requests (waiting for others to accept) */}
        {outgoingRequests.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Waiting ({outgoingRequests.length})</h3>
            {outgoingRequests.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg mb-2"
              >
                {contact.contact_picture ? (
                  <img
                    src={contact.contact_picture}
                    alt={contact.contact_name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center text-yellow-700 font-medium flex-shrink-0">
                    {contact.contact_name?.[0]?.toUpperCase() || contact.contact_email[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {contact.contact_name || contact.contact_email}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{contact.contact_email}</p>
                </div>
                <span className="text-xs font-medium text-yellow-700 bg-yellow-200 px-2 py-1 rounded-md flex-shrink-0">Pending</span>
              </div>
            ))}
          </div>
        )}

        {/* Accepted contacts */}
        {acceptedContacts.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contacts ({acceptedContacts.length})</h3>
            {acceptedContacts.map((contact) => (
              <div
                key={contact.id}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg transition-colors mb-1 group"
              >
                <button
                  onClick={() => onSelectContact(contact)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  {contact.contact_picture ? (
                    <img
                      src={contact.contact_picture}
                      alt={contact.contact_name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-medium flex-shrink-0">
                      {contact.contact_name?.[0]?.toUpperCase() || contact.contact_email[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {contact.contact_name || contact.contact_email}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{contact.contact_email}</p>
                  </div>
                </button>
                <button
                  onClick={() => onDeleteContact(contact.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  title="Remove contact"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {contacts.length === 0 && (
          <p className="text-center text-gray-500 py-8">No contacts yet. Add someone by email!</p>
        )}
      </div>
    </div>
  );
}

interface AddContactModalProps {
  onClose: () => void;
  onAdd: (email: string) => Promise<{ success: boolean; error?: string }>;
  onInvite: (email: string) => void;
}

function AddContactModal({ onClose, onAdd, onInvite }: AddContactModalProps) {
  const [email, setEmail] = useState('');
  const [searchResult, setSearchResult] = useState<{ exists: boolean; user?: any; alreadyContacts?: boolean; contactStatus?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    try {
      const result = await contactsApi.search(email.trim());
      setSearchResult(result.data);
      if (!result.data.exists) {
        setShowInvite(true);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!searchResult?.user) return;
    const result = await onAdd(email);
    if (result.success) {
      onClose();
    }
  };

  const handleSendInvite = () => {
    onInvite(email);
    onClose();
  };

  const resetSearch = () => {
    setSearchResult(null);
    setShowInvite(false);
    setEmail('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Add Contact</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email address"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button
            type="submit"
            disabled={!email.trim() || isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Search result - User found */}
        {searchResult?.exists && searchResult.user && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              {searchResult.user.picture ? (
                <img
                  src={searchResult.user.picture}
                  alt={searchResult.user.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-medium">
                  {searchResult.user.name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1">
                <p className="font-medium text-gray-900">{searchResult.user.name || searchResult.user.email}</p>
                <p className="text-sm text-gray-600">{searchResult.user.email}</p>
              </div>
              {searchResult.alreadyContacts ? (
                <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">
                  {searchResult.contactStatus === 'accepted' ? 'Already contacts' : 'Pending'}
                </span>
              ) : (
                <button
                  onClick={handleAddContact}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  Add contact
                </button>
              )}
            </div>
          </div>
        )}

        {/* User not found - Show invite */}
        {showInvite && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-700 font-medium">User not found</p>
            <p className="text-sm text-gray-500 mt-1">Invite them to join the chat:</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleSendInvite}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
              >
                Send invite email
              </button>
              <button
                onClick={resetSearch}
                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
              >
                Search again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
