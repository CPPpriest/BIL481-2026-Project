const API_BASE = '/api';

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

async function apiRequest(path, { method = 'GET', body, headers = {}, isMultipart = false } = {}) {
  const finalHeaders = { ...headers };
  if (!isMultipart && body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (method !== 'GET' && method !== 'HEAD') {
    const csrfToken = readCookie('XSRF-TOKEN');
    if (csrfToken) finalHeaders['X-XSRF-TOKEN'] = csrfToken;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: finalHeaders,
    body: isMultipart ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const problem = await response.json();
      detail = problem.detail || problem.message || detail;
    } catch {
      // Non-JSON error body
    }
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }

  return response.status === 204 ? null : response.json();
}

function buildPostFormData(postWriteRequest, imageFile) {
  const formData = new FormData();
  formData.append('post', new Blob([JSON.stringify(postWriteRequest)], { type: 'application/json' }));
  if (imageFile) formData.append('image', imageFile);
  return formData;
}

// UC1: Authentication & Verification (§2.3.1, FR-01..FR-05)
export const register = (registerRequest) =>
  apiRequest('/auth/register', { method: 'POST', body: registerRequest });

export const verifyEmail = (token) =>
  apiRequest(`/auth/verify?${new URLSearchParams({ token }).toString()}`);

export const login = (loginRequest) =>
  apiRequest('/auth/login', { method: 'POST', body: loginRequest });

export const logout = () =>
  apiRequest('/auth/logout', { method: 'POST' });

// UC2 & UC3: Posts, Feed & Search (§2.3.2, FR-09..FR-17)
export function searchPosts(criteria = {}) {
  const params = new URLSearchParams();
  const { keyword, category, subtype, status = 'ACTIVE', from, to, page = 0 } = criteria;
  if (keyword) params.set('keyword', keyword);
  if (category) params.set('category', category);
  if (subtype) params.set('subtype', subtype);
  if (status) params.set('status', status);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  params.set('page', String(page));
  return apiRequest(`/posts?${params.toString()}`);
}

export const getPostDetail = (postId) =>
  apiRequest(`/posts/${encodeURIComponent(postId)}`);

export const createPost = (postWriteRequest, imageFile = null) =>
  apiRequest('/posts', { method: 'POST', body: buildPostFormData(postWriteRequest, imageFile), isMultipart: true });

export const updatePost = (postId, postWriteRequest, imageFile = null) =>
  apiRequest(`/posts/${encodeURIComponent(postId)}`, { method: 'PUT', body: buildPostFormData(postWriteRequest, imageFile), isMultipart: true });

export const deletePost = (postId) =>
  apiRequest(`/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' });

export const resolvePost = (postId) =>
  apiRequest(`/posts/${encodeURIComponent(postId)}/resolve`, { method: 'PATCH' });

// UC3: Anonymous In-App Messaging (§2.3.3, FR-19..FR-21)
export const startConversation = (postId, startConversationRequest) =>
  apiRequest(`/posts/${encodeURIComponent(postId)}/conversations`, { method: 'POST', body: startConversationRequest });

export const listConversations = () =>
  apiRequest('/conversations');

export const sendMessage = (conversationId, sendMessageRequest) =>
  apiRequest(`/conversations/${encodeURIComponent(conversationId)}/messages`, { method: 'POST', body: sendMessageRequest });

// UC4: Reporting & Admin Moderation (§2.3.4, FR-25..FR-28)
export const submitReport = (postId, createReportRequest) =>
  apiRequest(`/posts/${encodeURIComponent(postId)}/reports`, { method: 'POST', body: createReportRequest });

export const listReportedPosts = (page = 0) =>
  apiRequest(`/admin/reports?${new URLSearchParams({ page: String(page) }).toString()}`);

export const moderatePost = (postId, action) =>
  apiRequest(`/admin/posts/${encodeURIComponent(postId)}`, { method: 'PATCH', body: { action } });

export const setUserSuspension = (userId, suspended) =>
  apiRequest(`/admin/users/${encodeURIComponent(userId)}/suspension`, { method: 'PATCH', body: { suspended } });