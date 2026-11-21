/**
 * Chat client for the running app. In "fixtures" data mode the local fake
 * stream is used (and the fixture banner is shown); a failure scenario can be
 * forced with `?chat=slow|agent-error|interrupted|invalid-frame|unauthorized|rate-limited`.
 * In "gateway" mode requests go to /api/v1/chat/stream, rewritten to the gateway.
 */
import { getDataSourceMode } from '../gateway';
import { createChatStreamClient, type ChatStreamClient } from './chatStreamClient';
import { createFakeChatTransport, FAKE_CHAT_SCENARIOS, type FakeChatScenario } from './fakeChatTransport';

export function getChatScenario(search: string): FakeChatScenario {
  const value = new URLSearchParams(search).get('chat');
  return FAKE_CHAT_SCENARIOS.includes(value as FakeChatScenario) ? (value as FakeChatScenario) : 'success';
}

/** Call from client components only. */
export function createAppChatClient(): ChatStreamClient {
  if (getDataSourceMode() === 'fixtures') {
    const scenario = typeof window === 'undefined' ? 'success' : getChatScenario(window.location.search);
    return createChatStreamClient({ transport: createFakeChatTransport({ scenario }) });
  }
  return createChatStreamClient({ transport: (input, init) => fetch(input, init) });
}
