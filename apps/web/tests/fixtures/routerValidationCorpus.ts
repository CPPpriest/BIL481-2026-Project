import type { HeldOutQuery } from './routerHeldOutCorpus.js';

/**
 * Second, fresh validation set (task Y-01).
 *
 * Written after the baseline held-out run but BEFORE the router was changed,
 * so that the fix (which was guided by the error categories found in the
 * first held-out set) can be checked on queries it was not tuned against.
 */
export const ROUTER_VALIDATION_CORPUS: readonly HeldOutQuery[] = [
  { query: 'Yemekhanede bugün tatlı var mı?', language: 'TR', expected: 'CAFETERIA', compound: false },
  { query: 'Öğlen ne yiyeceğiz', language: 'TR', expected: 'CAFETERIA', compound: false },
  { query: 'Dinner options for today', language: 'EN', expected: 'CAFETERIA', compound: false },
  { query: 'Show me the meals', language: 'EN', expected: 'CAFETERIA', compound: false },

  { query: 'Ringlerin saatini söyler misin', language: 'TR', expected: 'SHUTTLE', compound: false },
  { query: 'Metroya giden servis kaçta', language: 'TR', expected: 'SHUTTLE', compound: false },
  { query: 'Upcoming buses on the dormitory line', language: 'EN', expected: 'SHUTTLE', compound: false },
  { query: 'Is the shuttle late?', language: 'EN', expected: 'SHUTTLE', compound: false },

  { query: 'Kütüphanenin ikinci katı dolu mu', language: 'TR', expected: 'LIBRARY', compound: false },
  { query: 'Kütüphanede oturacak yer var mı', language: 'TR', expected: 'LIBRARY', compound: false },
  { query: 'How busy is the library?', language: 'EN', expected: 'LIBRARY', compound: false },
  { query: 'Library third floor', language: 'EN', expected: 'LIBRARY', compound: false },

  { query: 'Dersten çıkınca yemekhaneye yetişir miyim?', language: 'TR', expected: 'AGENT', compound: true },
  { query: 'Laboratuvar dersimden sonra metro servisi var mı', language: 'TR', expected: 'AGENT', compound: true },
  { query: 'If my lecture finishes at noon, what is for lunch?', language: 'EN', expected: 'AGENT', compound: true },
  { query: 'Library seats and dinner menu', language: 'EN', expected: 'AGENT', compound: true },

  { query: 'Pazartesi derslerim neler', language: 'TR', expected: 'AGENT', compound: false },
  { query: 'Sınavım ne zaman?', language: 'TR', expected: 'AGENT', compound: false },
  { query: 'My course schedule for Friday', language: 'EN', expected: 'AGENT', compound: false },
  { query: 'Good morning', language: 'EN', expected: 'AGENT', compound: false },
];
