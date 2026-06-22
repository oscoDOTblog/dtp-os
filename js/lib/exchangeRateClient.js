/**
 * Frankfurter API client — free ECB-based exchange rates, no API key.
 * https://www.frankfurter.app/docs/
 */

const BASE_URL = "https://api.frankfurter.app";

export async function fetchCurrencies(signal) {
  const response = await fetch(`${BASE_URL}/currencies`, { signal });

  if (!response.ok) {
    throw new Error(`Failed to load currencies: HTTP ${response.status}`);
  }

  const data = await response.json();
  return Object.entries(data)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export async function convert(amount, from, to, signal) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Enter a valid amount greater than zero");
  }

  if (from === to) {
    return {
      amount: numericAmount,
      base: from,
      date: new Date().toISOString().slice(0, 10),
      rates: { [to]: numericAmount },
    };
  }

  const params = new URLSearchParams({
    amount: String(numericAmount),
    from,
    to,
  });

  const response = await fetch(`${BASE_URL}/latest?${params}`, { signal });

  if (!response.ok) {
    throw new Error(`Conversion failed: HTTP ${response.status}`);
  }

  return await response.json();
}
