const Settings = require("../models/Settings");

let cache = {
  currency: null,
  loadedAt: 0,
};

const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

async function loadSettings() {
  const now = Date.now();
  if (cache.currency && now - cache.loadedAt < CACHE_TTL_MS) {
    return { currency: cache.currency };
  }

  let doc = await Settings.findById("global");
  if (!doc) {
    // initialize with env or USD
    const defaultCurrency = (process.env.DEFAULT_CURRENCY || "USD").toUpperCase();
    doc = await Settings.findOneAndUpdate(
      { _id: "global" },
      { $setOnInsert: { currency: defaultCurrency } },
      { new: true, upsert: true }
    );
  }

  cache.currency = (doc.currency || process.env.DEFAULT_CURRENCY || "USD").toUpperCase();
  cache.loadedAt = now;
  return { currency: cache.currency };
}

async function getCurrency() {
  const s = await loadSettings();
  return s.currency;
}

async function setCurrency(newCurrency) {
  if (!newCurrency || typeof newCurrency !== "string") {
    throw new Error("currency must be a 3-letter string like USD, EUR");
  }
  const cur = newCurrency.toUpperCase().trim();
  if (cur.length !== 3) {
    throw new Error("currency must be a 3-letter ISO code");
  }
  const doc = await Settings.findOneAndUpdate(
    { _id: "global" },
    { $set: { currency: cur } },
    { new: true, upsert: true }
  );
  cache.currency = doc.currency;
  cache.loadedAt = Date.now();
  return doc.currency;
}

module.exports = { getCurrency, setCurrency };
