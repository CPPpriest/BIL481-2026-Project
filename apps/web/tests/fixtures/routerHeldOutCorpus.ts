/**
 * Held-out evaluation corpus for the FR-16 intent router (task Y-01).
 *
 * These 40 queries were written AFTER the router patterns and were not used to
 * tune them. They measure how the router generalises to new phrasings, in
 * contrast to the 40-query benchmark in routeStudentQuery.test.ts, which was
 * written together with the patterns.
 *
 * Labels follow the design rule in docs/_sections/yunus-usecases-ui.md §2.2:
 * only a clear single-domain cafeteria, shuttle or library question may use
 * the direct widget path; anything compound, personal (course schedule),
 * ambiguous or off-topic must go to the LLM agent.
 */

export type ExpectedLabel = 'CAFETERIA' | 'SHUTTLE' | 'LIBRARY' | 'AGENT';

export interface HeldOutQuery {
  query: string;
  language: 'TR' | 'EN';
  expected: ExpectedLabel;
  /** True when the query combines several needs; FR-16 requires 100 % agent routing for these. */
  compound: boolean;
}

export const ROUTER_HELD_OUT_CORPUS: readonly HeldOutQuery[] = [
  // Cafeteria — direct (8)
  { query: 'Yemekhane bugün ne çıkarıyor?', language: 'TR', expected: 'CAFETERIA', compound: false },
  { query: 'Akşam yemeğinde çorba var mı?', language: 'TR', expected: 'CAFETERIA', compound: false },
  { query: 'Bugünkü öğle menüsü nedir', language: 'TR', expected: 'CAFETERIA', compound: false },
  { query: 'Yarının yemek listesi', language: 'TR', expected: 'CAFETERIA', compound: false },
  { query: "What's on the menu tonight?", language: 'EN', expected: 'CAFETERIA', compound: false },
  { query: 'Is there a vegetarian lunch option?', language: 'EN', expected: 'CAFETERIA', compound: false },
  { query: 'cafeteria dinner', language: 'EN', expected: 'CAFETERIA', compound: false },
  { query: 'How many calories is today’s lunch?', language: 'EN', expected: 'CAFETERIA', compound: false },

  // Shuttle — direct (8)
  { query: 'Ring kaçta kalkıyor?', language: 'TR', expected: 'SHUTTLE', compound: false },
  { query: 'Metro hattı ne zaman geliyor', language: 'TR', expected: 'SHUTTLE', compound: false },
  { query: 'Yurt servisinin saatleri', language: 'TR', expected: 'SHUTTLE', compound: false },
  { query: 'Bir sonraki otobüs kaçta?', language: 'TR', expected: 'SHUTTLE', compound: false },
  { query: 'When does the bus leave?', language: 'EN', expected: 'SHUTTLE', compound: false },
  { query: 'Next ring to the metro station', language: 'EN', expected: 'SHUTTLE', compound: false },
  { query: 'Shuttle times for the main ring', language: 'EN', expected: 'SHUTTLE', compound: false },
  { query: 'How many shuttles are running now?', language: 'EN', expected: 'SHUTTLE', compound: false },

  // Library — direct (8)
  { query: 'Kütüphanede kaç kişi var?', language: 'TR', expected: 'LIBRARY', compound: false },
  { query: 'Kütüphane üçüncü kat boş mu', language: 'TR', expected: 'LIBRARY', compound: false },
  { query: 'Şu an kütüphane kalabalık mı?', language: 'TR', expected: 'LIBRARY', compound: false },
  { query: 'Kütüphane doluluk durumu', language: 'TR', expected: 'LIBRARY', compound: false },
  { query: 'Is the library crowded right now?', language: 'EN', expected: 'LIBRARY', compound: false },
  { query: 'library first floor seats', language: 'EN', expected: 'LIBRARY', compound: false },
  { query: 'Where can I find an available seat to study?', language: 'EN', expected: 'LIBRARY', compound: false },
  { query: 'Library capacity today', language: 'EN', expected: 'LIBRARY', compound: false },

  // Compound — must go to the agent (10)
  { query: '10:30 dersimden sonra ringe yetişir miyim, bugün yemekte ne var?', language: 'TR', expected: 'AGENT', compound: true },
  { query: 'Öğle yemeğinden sonra kütüphanede yer olur mu?', language: 'TR', expected: 'AGENT', compound: true },
  { query: 'Dersim bitince ring var mı?', language: 'TR', expected: 'AGENT', compound: true },
  { query: 'Ringle gidip yemeğe yetişir miyim', language: 'TR', expected: 'AGENT', compound: true },
  { query: 'Yemek ve kütüphane durumunu özetle', language: 'TR', expected: 'AGENT', compound: true },
  { query: 'After my last lecture, is there a shuttle?', language: 'EN', expected: 'AGENT', compound: true },
  { query: 'Lunch menu plus the next ring please', language: 'EN', expected: 'AGENT', compound: true },
  { query: 'Can I grab dinner before the dormitory shuttle?', language: 'EN', expected: 'AGENT', compound: true },
  { query: 'When my class ends can I find a library seat?', language: 'EN', expected: 'AGENT', compound: true },
  { query: 'menu & shuttle', language: 'EN', expected: 'AGENT', compound: true },

  // Personal / off-topic — agent (6)
  { query: 'Yarın kaç dersim var?', language: 'TR', expected: 'AGENT', compound: false },
  { query: 'Bugünkü ders programım', language: 'TR', expected: 'AGENT', compound: false },
  { query: 'Teşekkürler!', language: 'TR', expected: 'AGENT', compound: false },
  { query: 'What classes do I have on Monday?', language: 'EN', expected: 'AGENT', compound: false },
  { query: 'Where is the registrar office?', language: 'EN', expected: 'AGENT', compound: false },
  { query: 'Tell me a joke', language: 'EN', expected: 'AGENT', compound: false },
];
