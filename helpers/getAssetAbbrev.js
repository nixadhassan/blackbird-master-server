// getAssetAbbriev.js

const symbolToAssetMap = {
  GOLD: "XAU",
  SILVER: "XAG",
  USOIL: "OIL",
  UKOIL: "OIL",
  XAUUSD: "XAU",
  XAGUSD: "XAG",
  BTCUSD: "BTC",
  ETHUSD: "ETH",
  BTCUSDT: "BTC",
  ETHUSDT: "ETH",
};

module.exports = getAssetAbbrev = (symbol = "") => {
  const cleaned = symbol.toUpperCase().replace(/[^A-Z]/g, "");

  // Direct match
  if (symbolToAssetMap[cleaned]) return symbolToAssetMap[cleaned];

  // Fallback to extracting base asset (e.g., EURUSD → EUR)
  if (cleaned.length >= 6) return cleaned.slice(0, 3);

  // Otherwise just return cleaned symbol
  return cleaned;
};
