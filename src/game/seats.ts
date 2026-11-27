export interface SeatSlotInfo {
  slot: number;
  xStart: number;
  xEnd: number;
  centerX: number;
  occupied: boolean;
  passengerVariant: number;
}

/**
 * Dynamically scales seated commuter occupancy by bus line number:
 * Line 1 (early): ~40% seated
 * Line 2 (mid):   ~70% seated
 * Line 3 (peak):  ~90% seated (always preserving slot 0 and ~10% seats for resting)
 */
export function isBusSeatOccupied(lineNumber: 1 | 2 | 3, slot: number): boolean {
  if (slot < 1) return false;
  const hash = (slot * 7 + lineNumber * 5) % 10;
  const threshold = lineNumber === 1 ? 4 : lineNumber === 2 ? 7 : 9;
  return hash < threshold;
}

/**
 * Dynamically scales standing background commuters per bay based on line number.
 */
export function getStandingCommutersAtBay(lineNumber: 1 | 2 | 3, bay: number): number {
  if (bay < 1) return 0;
  const hash = (bay * 11 + lineNumber * 3) % 10;
  if (lineNumber === 1) {
    return bay % 4 === 2 ? 1 : 0;
  }
  if (lineNumber === 2) {
    return bay % 2 === 1 ? 1 : hash < 3 ? 1 : 0;
  }
  // Line 3: crowded rush hour with 1-2 background commuters in most bays
  return hash < 4 ? 2 : 1;
}

export function getBusSeatInfoAtSlot(
  lineNumber: 1 | 2 | 3,
  slot: number,
  turnstileX: number
): SeatSlotInfo | null {
  if (slot < 0) return null;
  const bay = Math.floor(slot / 2);
  const isRight = slot % 2 === 1;
  const bayStart = bay * 76;
  if (bayStart > turnstileX - 45) return null;

  const xStart = bayStart + (isRight ? 43 : 11);
  const xEnd = xStart + 28;
  return {
    slot,
    xStart,
    xEnd,
    centerX: xStart + 14,
    occupied: isBusSeatOccupied(lineNumber, slot),
    passengerVariant: (slot * 3 + lineNumber) % 5,
  };
}

export function findBusSeatAtX(
  lineNumber: 1 | 2 | 3,
  worldX: number,
  turnstileX: number
): SeatSlotInfo | null {
  if (worldX < 8 || worldX > turnstileX - 45) return null;
  const bay = Math.floor(worldX / 76);
  const localX = worldX - bay * 76;

  if (localX >= 9 && localX <= 41) {
    return getBusSeatInfoAtSlot(lineNumber, bay * 2, turnstileX);
  }
  if (localX >= 41 && localX <= 73) {
    return getBusSeatInfoAtSlot(lineNumber, bay * 2 + 1, turnstileX);
  }
  return null;
}

export function findOpenBusSeatInRange(
  lineNumber: 1 | 2 | 3,
  minX: number,
  maxX: number,
  turnstileX: number,
  preferFromX?: number,
  usedSeatSlots?: Set<number>
): SeatSlotInfo | null {
  const tier1: SeatSlotInfo[] = [];
  const tier2: SeatSlotInfo[] = [];
  const tier3: SeatSlotInfo[] = [];

  for (let slot = 0; slot < 80; slot++) {
    const seat = getBusSeatInfoAtSlot(lineNumber, slot, turnstileX);
    if (!seat) break;
    if (seat.centerX < minX || seat.centerX > maxX) continue;

    if (!seat.occupied && (!usedSeatSlots || !usedSeatSlots.has(seat.slot))) {
      tier1.push(seat);
    } else if (!seat.occupied) {
      tier2.push(seat);
    } else {
      tier3.push(seat);
    }
  }

  const pool = tier1.length > 0 ? tier1 : tier2.length > 0 ? tier2 : tier3;
  if (pool.length === 0) return null;

  if (preferFromX === undefined) return pool[0];
  let best = pool[0];
  let bestDist = Math.abs(pool[0].centerX - preferFromX);
  for (let i = 1; i < pool.length; i++) {
    const d = Math.abs(pool[i].centerX - preferFromX);
    if (d < bestDist) {
      best = pool[i];
      bestDist = d;
    }
  }
  return best;
}
