import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/auth/signin';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  connectWallet: (walletAddress: string) => api.post('/auth/connect-wallet', { walletAddress }),
  getMe: () => api.get('/auth/me'),
};

// Projects API
export const projectsAPI = {
  getAll: (params?: any) => api.get('/projects', { params }),
  getById: (id: string) => api.get(`/projects/${id}`),
  create: (data: any) => api.post('/projects', data),
  update: (id: string, data: any) => api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

// Proposals API
export const proposalsAPI = {
  create: (data: any) => api.post('/proposals', data),
  getByProject: (projectId: string) => api.get(`/proposals/project/${projectId}`),
  accept: (id: string) => api.post(`/proposals/${id}/accept`),
  reject: (id: string) => api.post(`/proposals/${id}/reject`),
  getMy: () => api.get('/proposals/my-proposals'),
};

// Users API
export const usersAPI = {
  getAll: (params?: any) => api.get('/users', { params }),
  getById: (id: string) => api.get(`/users/${id}`),
  updateProfile: (data: any) => api.put('/users/profile', data),
};

// Messages API
export const messagesAPI = {
  send: (data: any) => api.post('/messages', data),
  getByProject: (projectId: string, params?: any) => api.get(`/messages/project/${projectId}`, { params }),
  getUnreadCount: () => api.get('/messages/unread-count'),
  getConversations: () => api.get('/messages/conversations'),
};

// Contracts API
export const contractsAPI = {
  createProject: (data: any) => api.post('/contracts/create-project', data),
  submitProposal: (data: any) => api.post('/contracts/submit-proposal', data),
  acceptProposal: (data: any) => api.post('/contracts/accept-proposal', data),
  completeProject: (data: any) => api.post('/contracts/complete-project', data),
  getProject: (blockchainId: string) => api.get(`/contracts/project/${blockchainId}`),
};

export default api;