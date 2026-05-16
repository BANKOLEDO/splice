import { create } from 'zustand';

interface Artifact {
  id: string;
  type: string;
  title: string;
  content: string;
  owner_role: string;
  status: string;
  dependencies: string[];
  created_by: string;
  created_at: number;
  updated_at: number;
  metadata: Record<string, any>;
}

interface Message {
  id: string;
  author: string;
  role: string;
  content: string;
  attachments: string[];
  mentions: string[];
  created_at: number;
}

interface Thread {
  id: string | null;
  artifact_id: string;
  resolved: boolean;
  messages: Message[];
}

interface ArtifactsState {
  artifacts: Artifact[];
  currentArtifact: Artifact | null;
  currentThread: Thread | null;
  isLoading: boolean;
  error: string | null;
  filter: { status?: string; type?: string; search?: string };
  fetchArtifacts: (params?: { status?: string; owner?: string; type?: string }) => Promise<void>;
  fetchArtifact: (id: string) => Promise<Artifact>;
  fetchThread: (artifactId: string) => Promise<Thread>;
  addMessage: (artifactId: string, msg: Partial<Message>) => Promise<void>;
  setFilter: (filter: { status?: string; type?: string; search?: string }) => void;
  clearError: () => void;
}

import { useAuthStore } from './authStore';

const IS_DEV = typeof __DEV__ === 'undefined' ? process.env.NODE_ENV !== 'production' : __DEV__;
const API_BASE = IS_DEV ? 'http://localhost:8000' : 'https://splice-api.onrender.com';

async function apiRequest(path: string, options: RequestInit = {}) {
  const token = useAuthStore.getState().token;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API Error ${res.status}: ${err}`);
  }
  return res.json();
}

export const useArtifactsStore = create<ArtifactsState>((set, get) => ({
  artifacts: [],
  currentArtifact: null,
  currentThread: null,
  isLoading: false,
  error: null,
  filter: {},

  fetchArtifacts: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.owner) qs.set('owner', params.owner);
      if (params?.type) qs.set('type', params.type);
      const data = await apiRequest(`/api/artifacts?${qs.toString()}`);
      set({ artifacts: data, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  fetchArtifact: async (id) => {
    const data = await apiRequest(`/api/artifacts/${id}`);
    set({ currentArtifact: data });
    return data;
  },

  fetchThread: async (artifactId) => {
    const data = await apiRequest(`/api/artifacts/${artifactId}/thread`);
    set({ currentThread: data });
    return data;
  },

  addMessage: async (artifactId, msg) => {
    await apiRequest(`/api/artifacts/${artifactId}/messages`, {
      method: 'POST',
      body: JSON.stringify(msg),
    });
    const thread = await get().fetchThread(artifactId);
    set({ currentThread: thread });
  },

  setFilter: (filter) => {
    set({ filter });
  },

  clearError: () => {
    set({ error: null });
  },
}));
