/**
 * Generates a random 5-digit Order ID (e.g. 58291, 10492, 73620).
 * Every order gets a random 5-digit identifier as requested.
 */
export function generateRandom5DigitOrderId(): string {
  // Generate random number between 10000 and 99999 inclusive
  const random5Digit = Math.floor(10000 + Math.random() * 90000);
  return String(random5Digit);
}

export async function generateDailyOrderId(): Promise<string> {
  return generateRandom5DigitOrderId();
}

