/**
 * The list of question/answer turns shown on the assistant page (UC-04).
 * Kept only in memory for the open page: every question is sent on its own
 * (`{ message }`, API Contract v1.1 §3.3), so no history goes to the server.
 */
import { initialChatTurn, type ChatTurnState } from './chatTurn';

export interface ConversationTurn {
  id: string;
  question: string;
  answer: ChatTurnState;
}

export type ConversationAction =
  /** A new question was sent. */
  | { type: 'start'; id: string; question: string }
  /** The stream client reported a new state for a turn. */
  | { type: 'update'; id: string; answer: ChatTurnState }
  /** The user pressed "Tekrar dene": the same question is sent again in place. */
  | { type: 'restart'; id: string }
  | { type: 'clear' };

/** Older turns are dropped so a long session does not grow without limit. */
export const MAX_TURNS = 20;

export function conversationReducer(turns: readonly ConversationTurn[], action: ConversationAction): ConversationTurn[] {
  switch (action.type) {
    case 'start':
      return [...turns, { id: action.id, question: action.question, answer: initialChatTurn() }].slice(-MAX_TURNS);
    case 'update':
      return turns.map((turn) => (turn.id === action.id ? { ...turn, answer: action.answer } : turn));
    case 'restart':
      return turns.map((turn) => (turn.id === action.id ? { ...turn, answer: initialChatTurn() } : turn));
    case 'clear':
      return [];
  }
}

/** True while an answer is still arriving; only one question is in flight at a time. */
export function isTurnOpen(turn: ConversationTurn | undefined): boolean {
  return turn !== undefined && (turn.answer.phase === 'connecting' || turn.answer.phase === 'streaming');
}
