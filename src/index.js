// src/index.js
const OPENSKY_URL = "https://opensky-network.org/api/states/all";

// Bounding box kira-kira Indonesia (silakan ubah)
const BBOX = {
  lamin: -11.5,
  lomin: 95.0,
  lamax: 6.0,
  lomax: 141.0,
};

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function fetchOpenSkyStates() {
  const url = new URL(OPENSKY_URL);
  for (const [k, v] of Object.entries(BBOX)) url.searchParams.set(k, String(v));

  const res = await fetch(url, { headers: { "User-Agent": "flight-notify-bot" } });
  if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sendTelegramMessage(text) {
  const token = env("TELEGRAM_BOT_TOKEN");
  const chatId = env("TELEGRAM_CHAT_ID");

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) throw new Error(`Telegram HTTP ${res.status}: ${await res.text()}`);
}

function formatSummary(data) {
  const states = Array.isArray(data.states) ? data.states : [];
  const time = data.time ? new Date(data.time * 1000).toISOString() : new Date().toISOString();

  // Format state OpenSky: array; callsign berada di index 1, origin_country index 2 (lihat docs OpenSky)
  const sample = states
    .slice(0, 8)
    .map((s) => String(s?.[1] ?? "").trim())
    .filter(Boolean);

  const lines = [
    `✈️ OpenSky (Indonesia bbox)`,
    `Time: ${time}`,
    `Tracked aircraft: ${states.length}`,
    sample.length ? `Sample callsigns: ${sample.join(", ")}` : `Sample callsigns: (none)`,
  ];

  return lines.join("\n");
}

async function main() {
  const data = await fetchOpenSkyStates();
  const msg = formatSummary(data);
  await sendTelegramMessage(msg);
  console.log("Sent:", msg);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
