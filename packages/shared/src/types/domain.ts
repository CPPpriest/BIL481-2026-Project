/**
 * Domain Models for Campus Data Orchestrator
 */

/**
 * Cafeteria lunch meal details (FR-03)
 */
export interface CafeteriaLunchMenu {
  soup: string;
  mainDish: string;
  vegOption: string;
  sideDish: string;
  calories: number;
  allergens?: string[];
}

/**
 * Cafeteria dinner meal details (FR-03)
 */
export interface CafeteriaDinnerMenu {
  soup: string;
  mainDish: string;
  sideDish: string;
  calories: number;
}

/**
 * Daily Cafeteria Menu representation (FR-03)
 */
export interface CafeteriaDailyMenu {
  date: string;
  lunch: CafeteriaLunchMenu | null;
  dinner: CafeteriaDinnerMenu | null;
  available: boolean;
  unavailableReason?: string;
}

/**
 * Shuttle Route and Timetable Data (FR-04)
 */
export interface ShuttleRouteData {
  routeId: string;
  routeName: string;
  nextDepartures: string[];
  activeVehicles: number;
  lastUpdated: string;
}

/**
 * Library floor occupancy details (FR-05)
 */
export interface LibraryFloorOccupancy {
  floorId: string;
  name: string;
  occupiedSeats: number;
  maxSeats: number;
  isQuietArea: boolean;
}

/**
 * Real-time Library Occupancy Report (FR-05)
 */
export interface LibraryOccupancyReport {
  timestamp: string;
  isSimulated: boolean;
  totalCapacity: number;
  totalOccupied: number;
  floors: LibraryFloorOccupancy[];
}

/**
 * Student Information System (SIS) Course Timetable Entry (FR-06)
 */
export interface StudentClassEntry {
  courseCode: string;
  courseTitle: string;
  instructor: string;
  classroom: string;
  day?: string;
  startTime: string;
  endTime: string;
}
