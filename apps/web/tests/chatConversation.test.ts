import { describe, expect, it } from 'vitest';
import { getChatScenario } from '../src/lib/chat/appClient';
import { initialChatTurn, type ChatTurnState } from '../src/lib/chat/chatTurn';
import { conversationReducer, isTurnOpen, MAX_TURNS, type ConversationTurn } from '../src/lib/chat/conversation';
import { canRetry, chatErrorText, endsSession, toolLabel, toolStatusLabel } from '../src/lib/chat/presentation';

/** Y-07: conversation state and display rules of the assistant page (UC-04). */

const done: ChatTurnState = { ...initialChatTurn(), phase: 'done', text: 'Cevap', toolsInvoked: [], isComplete: true };

describe('conversation reducer', () => {
  it('adds a question with an empty, connecting answer', () => {
    const turns = conversationReducer([], { type: 'start', id: 't1', question: 'Soru?' });

    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ id: 't1', question: 'Soru?', answer: { phase: 'connecting', text: '' } });
    expect(isTurnOpen(turns[0])).toBe(true);
  });

  it('updates only the matching turn', () => {
    let turns = conversationReducer([], { type: 'start', id: 't1', question: 'A' });
    turns = conversationReducer(turns, { type: 'start', id: 't2', question: 'B' });
    turns = conversationReducer(turns, { type: 'update', id: 't1', answer: done });

    expect(turns[0]?.answer.phase).toBe('done');
    expect(turns[1]?.answer.phase).toBe('connecting');
    expect(isTurnOpen(turns[0])).toBe(false);
  });

  it('restarts a failed turn in place, keeping the question (explicit retry, no duplicate)', () => {
    const failed: ChatTurnState = {
      ...initialChatTurn(),
      phase: 'error',
      text: 'yarım',
      error: { code: 'STREAM_INTERRUPTED', message: 'koptu' },
    };
    let turns = conversationReducer([], { type: 'start', id: 't1', question: 'Soru?' });
    turns = conversationReducer(turns, { type: 'update', id: 't1', answer: failed });
    turns = conversationReducer(turns, { type: 'restart', id: 't1' });

    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ question: 'Soru?', answer: { phase: 'connecting', text: '', error: null } });
  });

  it('keeps at most MAX_TURNS turns and can be cleared', () => {
    let turns: ConversationTurn[] = [];
    for (let index = 0; index < MAX_TURNS + 5; index += 1) {
      turns = conversationReducer(turns, { type: 'start', id: `t${index}`, question: `Q${index}` });
    }

    expect(turns).toHaveLength(MAX_TURNS);
    expect(turns[0]?.id).toBe('t5');
    expect(conversationReducer(turns, { type: 'clear' })).toEqual([]);
  });
});

describe('chat presentation rules', () => {
  it('shows Turkish tool and status labels, and unknown tool names as they are', () => {
    expect(toolLabel('get_course_schedule')).toBe('Ders programı');
    expect(toolLabel('get_shuttle_schedule')).toBe('Ring seferleri');
    expect(toolLabel('get_cafeteria_menu')).toBe('Yemekhane menüsü');
    expect(toolLabel('get_weather')).toBe('get_weather');
    expect(toolStatusLabel('CACHE_HIT')).toBe('Önbellekten');
  });

  it('adds the wait time for rate limiting', () => {
    expect(chatErrorText({ code: 'RATE_LIMITED', message: 'Çok fazla istek gönderildi.', retryAfterSeconds: 30 })).toBe(
      'Çok fazla istek gönderildi. 30 saniye sonra tekrar dene.'
    );
  });

  it('offers retry for transient failures and a stopped question, not for auth or invalid input', () => {
    expect(canRetry({ code: 'STREAM_INTERRUPTED', message: '' })).toBe(true);
    expect(canRetry({ code: 'AGENT_ERROR', message: '' })).toBe(true);
    expect(canRetry({ code: 'CLIENT_TIMEOUT', message: '' })).toBe(true);
    expect(canRetry({ code: 'ABORTED', message: '' })).toBe(true);
    expect(canRetry({ code: 'AUTHENTICATION_REQUIRED', message: '', status: 401 })).toBe(false);
    expect(canRetry({ code: 'INVALID_PARAMS', message: '', status: 400 })).toBe(false);
  });

  it('ends the session only on a gateway 401, not on a local missing-token check', () => {
    expect(endsSession({ code: 'AUTHENTICATION_REQUIRED', message: '', status: 401 })).toBe(true);
    expect(endsSession({ code: 'AUTHENTICATION_REQUIRED', message: '' })).toBe(false);
    expect(endsSession({ code: 'DOWNSTREAM_ERROR', message: '', status: 502 })).toBe(false);
  });

  it('reads the fixture chat scenario from the URL and falls back to success', () => {
    expect(getChatScenario('?chat=slow')).toBe('slow');
    expect(getChatScenario('?chat=agent-error&x=1')).toBe('agent-error');
    expect(getChatScenario('?chat=nope')).toBe('success');
    expect(getChatScenario('')).toBe('success');
  });
});
