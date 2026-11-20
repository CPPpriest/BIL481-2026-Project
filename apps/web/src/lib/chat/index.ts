/**
 * Chat stream module for UC-04 (FR-17, FR-19). The assistant UI uses
 * `createChatStreamClient` with the browser fetch, or with
 * `createFakeChatTransport` while the real agent stream is not available.
 */
export * from './chatEvents';
export * from './chatTurn';
export * from './chatStreamClient';
export * from './sseParser';
export { createFakeChatTransport, FAKE_CHAT_SCENARIOS, type FakeChatScenario } from './fakeChatTransport';
