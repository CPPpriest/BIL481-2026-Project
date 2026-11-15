/**
 * Mock cafeteria connector — backs the `get_cafeteria_menu` tool (FR-03, FR-12).
 *
 * Behaviour:
 * - `date` defaults to today's date in Türkiye time.
 * - Impossible dates (e.g. 2026-02-30) → ConnectorInputError.
 * - Weekends and listed public holidays → `available: false` with a readable reason (no exception).
 * - Weekdays → lunch (soup, main dish, vegetarian option, side dish, calories, allergens)
 *   and dinner (soup, main dish, side dish, calories). Calories are the sum of the dish calories.
 * - Output is a pure function of (seed, date): same seed + same date → identical menu.
 */

import type {
  CafeteriaDailyMenu,
  CafeteriaDinnerMenu,
  CafeteriaLunchMenu,
  GetCafeteriaMenuInput,
} from '@campus-orchestrator/shared';
import {
  CAFETERIA_HOLIDAYS,
  MAIN_DISHES,
  SIDE_DISHES,
  SOUPS,
  VEGETARIAN_OPTIONS,
  WEEKEND_CLOSED_REASON,
  type DishFixture,
} from '../mock/fixtures/cafeteriaFixtures.js';
import { createSeededRandom } from '../mock/seededRandom.js';
import { isWeekend, parseIsoCalendarDate, toTurkeyLocalTime } from '../mock/turkeyTime.js';
import { systemClock, type CafeteriaConnector, type Clock, type ConnectorHealth } from '../types.js';

function uniqueAllergens(dishes: readonly DishFixture[]): string[] {
  return [...new Set(dishes.flatMap((dish) => dish.allergens))].sort();
}

export class MockCafeteriaConnector implements CafeteriaConnector {
  public readonly name = 'cafeteria' as const;
  public readonly mode = 'mock' as const;
  public readonly isMock = true;

  constructor(
    private readonly seed: string,
    private readonly clock: Clock = systemClock
  ) {}

  public async execute(input: GetCafeteriaMenuInput): Promise<CafeteriaDailyMenu> {
    const isoDate = input.date ?? toTurkeyLocalTime(this.clock()).isoDate;
    const { weekday } = parseIsoCalendarDate(isoDate);

    const holidayReason = CAFETERIA_HOLIDAYS[isoDate];
    if (holidayReason !== undefined) {
      return { date: isoDate, available: false, unavailableReason: holidayReason, lunch: null, dinner: null };
    }
    if (isWeekend(weekday)) {
      return { date: isoDate, available: false, unavailableReason: WEEKEND_CLOSED_REASON, lunch: null, dinner: null };
    }

    const random = createSeededRandom(this.seed, 'cafeteria', isoDate);

    const lunchSoup = random.pick(SOUPS);
    const lunchMain = random.pick(MAIN_DISHES);
    const lunchVeg = random.pick(VEGETARIAN_OPTIONS);
    const lunchSide = random.pick(SIDE_DISHES);
    const lunchDishes = [lunchSoup, lunchMain, lunchVeg, lunchSide];

    // Dinner never repeats the lunch soup or main dish.
    const dinnerSoup = random.pick(SOUPS.filter((dish) => dish !== lunchSoup));
    const dinnerMain = random.pick(MAIN_DISHES.filter((dish) => dish !== lunchMain));
    const dinnerSide = random.pick(SIDE_DISHES);

    const lunch: CafeteriaLunchMenu = {
      soup: lunchSoup.name,
      mainDish: lunchMain.name,
      vegOption: lunchVeg.name,
      sideDish: lunchSide.name,
      calories: lunchDishes.reduce((sum, dish) => sum + dish.calories, 0),
      allergens: uniqueAllergens(lunchDishes),
    };

    const dinner: CafeteriaDinnerMenu = {
      soup: dinnerSoup.name,
      mainDish: dinnerMain.name,
      sideDish: dinnerSide.name,
      calories: dinnerSoup.calories + dinnerMain.calories + dinnerSide.calories,
    };

    return { date: isoDate, available: true, lunch, dinner };
  }

  public async healthCheck(): Promise<ConnectorHealth> {
    return {
      connector: this.name,
      mode: this.mode,
      status: 'UP',
      checkedAt: this.clock().toISOString(),
      detail: 'Deterministic synthetic generator (no upstream dependency)',
    };
  }
}
