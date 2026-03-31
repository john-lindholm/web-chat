import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const contactsApi = {
  getAll: () => api.get('/contacts'),
  search: (email: string) => api.get(`/contacts/search?email=${encodeURIComponent(email)}`),
  add: (email: string) => api.post('/contacts', { email }),
  accept: (id: string) => api.put(`/contacts/${id}/accept`),
  delete: (id: string) => api.delete(`/contacts/${id}`),
};

export const conversationsApi = {
  getAll: () => api.get('/conversations'),
  getOrCreateDirect: (contactEmail: string) =>
    api.post(`/conversations/direct/${encodeURIComponent(contactEmail)}`),
};

export const uploadApi = {
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};
