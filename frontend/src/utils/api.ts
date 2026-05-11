const IS_DEV = typeof __DEV__ === 'undefined' ? process.env.NODE_ENV !== 'production' : __DEV__;
const BASE_URL = IS_DEV ? 'http://localhost:8000' : 'https://splice-api.onrender.com';

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error ${response.status}: ${error}`);
  }

  return response.json();
}

export const api = {
  // Artifacts
  getArtifacts: (params?: { status?: string; owner?: string; type?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.owner) searchParams.set('owner', params.owner);
    if (params?.type) searchParams.set('type', params.type);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    return request<any[]>(`/api/artifacts${qs ? `?${qs}` : ''}`);
  },

  getArtifact: (id: string) => request<any>(`/api/artifacts/${id}`),

  createArtifact: (data: any) =>
    request<{ success: boolean; id: string }>('/api/artifacts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateArtifact: (id: string, data: any) =>
    request<{ success: boolean; id: string }>(`/api/artifacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteArtifact: (id: string) =>
    request<{ success: boolean }>(`/api/artifacts/${id}`, {
      method: 'DELETE',
    }),

  // Threads & Messages
  getThread: (artifactId: string) => request<any>(`/api/artifacts/${artifactId}/thread`),

  addMessage: (artifactId: string, message: any) =>
    request<{ success: boolean; message_id: string }>(
      `/api/artifacts/${artifactId}/messages`,
      { method: 'POST', body: JSON.stringify(message) },
    ),

  resolveThread: (threadId: string) =>
    request<{ success: boolean }>(`/api/threads/${threadId}/resolve`, {
      method: 'POST',
    }),

  unresolveThread: (threadId: string) =>
    request<{ success: boolean }>(`/api/threads/${threadId}/unresolve`, {
      method: 'POST',
    }),

  // Spec Generation
  generateSpec: (artifactId: string) =>
    request<{ spec: string; metadata: any }>(
      `/api/artifacts/${artifactId}/generate-spec`,
      { method: 'POST' },
    ),

  // File Upload
  uploadFile: async (file: File, userId: string, artifactId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userId);
    if (artifactId) formData.append('artifact_id', artifactId);

    const response = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },

  getFiles: (artifactId?: string) => {
    const qs = artifactId ? `?artifact_id=${artifactId}` : '';
    return request<any[]>(`/api/files${qs}`);
  },

  // Users
  getOnlineUsers: () => request<any[]>('/api/users/online'),

  // Sync Points
  getSyncPoints: (artifactId?: string) => {
    const qs = artifactId ? `?artifact_id=${artifactId}` : '';
    return request<any[]>(`/api/sync-points${qs}`);
  },

  createSyncPoint: (data: any) =>
    request<{ success: boolean; id: string }>('/api/sync-points', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Typing indicator
  sendTyping: (artifactId: string, userId: string) =>
    request<{ success: boolean }>(`/api/artifacts/${artifactId}/typing`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  // Stats
  getStats: () => request<any>('/api/stats'),
};

export { BASE_URL };
