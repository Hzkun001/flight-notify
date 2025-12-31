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
      parse_mode: "Markdown"
    }),
  });

  if (!res.ok) throw new Error(`Telegram HTTP ${res.status}: ${await res.text()}`);
}

function formatSummary(data) {
  const states = Array.isArray(data.states) ? data.states : [];
  const timeUTC = data.time ? new Date(data.time * 1000) : new Date();

  const timeLocal = timeUTC.toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const callsigns = states
    .map((s) => String(s?.[1] ?? "").trim())
    .filter(Boolean)
    .slice(0, 5);

  return [
    "✈️ *Laporan Lalu Lintas Udara (Indonesia)*",
    "",
    `🕒 *Waktu:* ${timeLocal}`,
    `🛫 *Pesawat terdeteksi:* ${states.length}`,
    "",
    callsigns.length
      ? "📋 *Contoh penerbangan:*\n" + callsigns.map(c => `• ${c}`).join("\n")
      : "_Tidak ada data callsign_"
  ].join("\n");
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
