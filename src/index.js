const OPENSKY_URL = "https://opensky-network.org/api/states/all";

// Syamsudin Noor (WAOO / BDJ) ~ 3°26'32"S, 114°45'45"E
const AIRPORT = { name: "Syamsudin Noor (BDJ)", lat: -3.4422, lon: 114.7625 }; // :contentReference[oaicite:3]{index=3}
const RADIUS_KM = 50; // ubah sesuai kebutuhan (mis. 20/30/50 km)

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function toRad(d) {
  return (d * Math.PI) / 180;
}

// Haversine distance km
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function fetchOpenSkyStates() {
  const res = await fetch(OPENSKY_URL, { headers: { "User-Agent": "flight-notify-bot" } });
  if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sendTelegramMessage(text) {
  const token = env("TELEGRAM_BOT_TOKEN");
  const chatId = env("TELEGRAM_CHAT_ID");

  const url = `https://api.telegram.org/bot${token}/sendMessage`; // :contentReference[oaicite:4]{index=4}
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) throw new Error(`Telegram HTTP ${res.status}: ${await res.text()}`);
}

function formatReport(data, nearby) {
  const timeUTC = data.time ? new Date(data.time * 1000) : new Date();
  const timeLocal = timeUTC.toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const lines = [
    `🛬 *Traffic dekat Bandara*`,
    `*${AIRPORT.name}*`,
    ``,
    `🕒 ${timeLocal} (WITA)`,
    `📍 Radius: ${RADIUS_KM} km`,
    `✈️ Terdeteksi: *${nearby.length}* pesawat`,
  ];

  if (nearby.length) {
    lines.push(``, `📋 *Contoh (maks 8):*`);
    for (const a of nearby.slice(0, 8)) {
      lines.push(`• \`${a.callsign || a.icao24}\` — ${a.distKm.toFixed(1)} km`);
    }
  } else {
    lines.push(``, `_Tidak ada pesawat terdeteksi dalam radius ini._`);
  }

  return lines.join("\n");
}

async function main() {
  const data = await fetchOpenSkyStates();

  // OpenSky state vector fields: lon index 5, lat index 6, callsign index 1, icao24 index 0, baro_alt index 7, velocity index 9, true_track index 10. :contentReference[oaicite:5]{index=5}
  const states = Array.isArray(data.states) ? data.states : [];

  const nearby = states
    .map((s) => {
      const icao24 = s?.[0];
      const callsign = String(s?.[1] ?? "").trim();
      const lon = s?.[5];
      const lat = s?.[6];
      if (lat == null || lon == null) return null;

      const distKm = distanceKm(AIRPORT.lat, AIRPORT.lon, lat, lon);
      return { icao24, callsign, lat, lon, distKm };
    })
    .filter(Boolean)
    .filter((a) => a.distKm <= RADIUS_KM)
    .sort((a, b) => a.distKm - b.distKm);

  const msg = formatReport(data, nearby);
  await sendTelegramMessage(msg);
  console.log("Sent:", msg);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
