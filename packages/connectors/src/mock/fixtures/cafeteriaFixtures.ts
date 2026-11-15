/**
 * Synthetic cafeteria dish catalog (FR-03). Values are illustrative, not the real TOBB ETÜ menu.
 * Allergen labels follow common EU allergen names in English.
 */

export interface DishFixture {
  name: string;
  calories: number;
  allergens: readonly string[];
}

export const SOUPS: readonly DishFixture[] = [
  { name: 'Mercimek Çorbası', calories: 180, allergens: [] },
  { name: 'Ezogelin Çorbası', calories: 190, allergens: [] },
  { name: 'Yayla Çorbası', calories: 170, allergens: ['milk', 'egg'] },
  { name: 'Domates Çorbası', calories: 150, allergens: ['milk', 'gluten'] },
  { name: 'Tarhana Çorbası', calories: 160, allergens: ['gluten', 'milk'] },
  { name: 'Sebze Çorbası', calories: 130, allergens: ['celery'] },
];

export const MAIN_DISHES: readonly DishFixture[] = [
  { name: 'Orman Kebabı', calories: 420, allergens: [] },
  { name: 'Tavuk Sote', calories: 380, allergens: [] },
  { name: 'Etli Kuru Fasulye', calories: 410, allergens: [] },
  { name: 'Fırın Köfte', calories: 450, allergens: ['gluten', 'egg'] },
  { name: 'Izgara Tavuk Baget', calories: 390, allergens: [] },
  { name: 'Hünkar Beğendi', calories: 520, allergens: ['milk', 'gluten'] },
  { name: 'Etli Nohut', calories: 400, allergens: [] },
  { name: 'Fırında Mantı', calories: 480, allergens: ['gluten', 'egg', 'milk'] },
];

export const VEGETARIAN_OPTIONS: readonly DishFixture[] = [
  { name: 'Zeytinyağlı Taze Fasulye', calories: 210, allergens: [] },
  { name: 'Mücver', calories: 260, allergens: ['egg', 'gluten', 'milk'] },
  { name: 'Sebzeli Güveç', calories: 230, allergens: [] },
  { name: 'Zeytinyağlı Yaprak Sarma', calories: 250, allergens: [] },
  { name: 'Mantarlı Bulgur Pilavı', calories: 280, allergens: ['gluten'] },
  { name: 'Ispanaklı Börek', calories: 320, allergens: ['gluten', 'egg', 'milk'] },
];

export const SIDE_DISHES: readonly DishFixture[] = [
  { name: 'Pirinç Pilavı', calories: 220, allergens: [] },
  { name: 'Bulgur Pilavı', calories: 200, allergens: ['gluten'] },
  { name: 'Cacık', calories: 90, allergens: ['milk'] },
  { name: 'Mevsim Salata', calories: 60, allergens: [] },
  { name: 'Şehriyeli Pilav', calories: 240, allergens: ['gluten'] },
  { name: 'Ayran', calories: 70, allergens: ['milk'] },
];

/** Official public holidays in the 2026–2027 fall term when the cafeteria is closed. */
export const CAFETERIA_HOLIDAYS: Readonly<Record<string, string>> = {
  '2026-10-29': 'Republic Day (Cumhuriyet Bayramı) — cafeteria closed / yemekhane kapalı.',
  '2027-01-01': "New Year's Day (Yılbaşı) — cafeteria closed / yemekhane kapalı.",
};

export const WEEKEND_CLOSED_REASON =
  'The cafeteria does not serve meals on weekends (Saturday/Sunday). / Hafta sonu yemekhane hizmeti yoktur.';
