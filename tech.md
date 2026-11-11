# Spesifikasi Teknis: Garuda Sentinel // Indonesia Threat Watch (`tech.md`)

> Dokumentasi arsitektur pipeline, skema JSON, perhitungan vektor koordinat, dan konfigurasi CI/CD tanpa biaya (Zero-Cost Architecture).

---

## 1. Tech Stack & Infrastruktur (Rp 0)

| Komponen | Teknologi Pilihan | Alasan Teknis & Kuota Gratis |
|---|---|---|
| **Frontend UI & Peta** | HTML5, Tailwind CSS, Vanilla JS + **HTML5 Canvas 2D / GeoJSON** | Ringan, 60 FPS di perangkat kentang sekalipun, tanpa beban bundle library 3D besar, kontrol penuh atas efek radar militer. |
| **Hosting Frontend** | **Cloudflare Pages** | Bandwidth tak terbatas (unlimited), deploy otomatis dari GitHub, gratis subdomain `.pages.dev` atau custom domain. |
| **Pipeline "Backend"** | **GitHub Actions (Scheduled Cron)** + Python 3.11 | Berjalan tiap 15 atau 30 menit untuk menarik API, menormalisasi data, dan memperbarui JSON statis. |
| **Penyimpanan Data Statis** | **Dedicated Git Branch (`telemetry-data`)** atau **Cloudflare KV** | Menyimpan hasil `summary.json`, `events.json`, dan `blocklist.*` di branch terpisah dengan `git push --force` agar riwayat commit di branch `main` tidak kotor. |
| **GeoIP & ASN Lookup** | **MaxMind GeoLite2** (`GeoLite2-City.mmdb` & `GeoLite2-ASN.mmdb`) | Database binari lokal yang diunduh saat pipeline jalan; lookup ribuan IP hanya butuh hitungan milidetik tanpa terkena limit REST API. |
| **Sumber Telemetri** | **Cloudflare Radar API**, **abuse.ch** (Feodo/ThreatFox), **SANS DShield** | 100% gratis untuk penggunaan non-komersial/edukasi dengan atribusi sumber. |

---

## 2. Arsitektur Alur Data (Pipeline Flow)

```text
[Sumber OSINT & Telemetri]       [GitHub Actions Cron (Tiap 15 Menit)]                 [Distribusi Statis]
  Cloudflare Radar (ID) ──┐
  abuse.ch (Feodo/TF)   ──┼──> Python Fetchers ──> Normalisasi & Deduplikasi
  SANS ISC DShield      ──┘                              │
                                                         ▼
                                            Enrichment (MaxMind GeoLite2)
                                            + Kalkulasi Sudut Azimuth/Perimeter
                                                         │
                                                         ▼
                                      Generate: summary.json, events.json, blocklist.rsc
                                                         │
                                                         ▼
                                      Force-Push ke branch `telemetry-data` ──────> Frontend Fetch (CF Pages)
```

---

## 3. Solusi Teknis: Perhitungan Koordinat Perimeter Indonesia

Karena viewport peta dikunci khusus wilayah Indonesia (`Lat: 7.5° LU s/d -12.0° LS`, `Lng: 94.0° BT s/d 142.0° BT`), serangan yang berasal dari luar negeri (misal Moskow `55.75, 37.61`) tidak digambar dari koordinat aslinya di luar kanvas, melainkan diproyeksikan ke **Titik Masuk Perimeter (Perimeter Entry Point)** di tepi batas radar Indonesia:

1. **Hitung Sudut Arah (Bearing / Azimuth):**
   Saat pipeline Python memproses IP asal `(lat1, lng1)` menuju kota target di Indonesia `(lat2, lng2)`, hitung sudut datangnya menggunakan rumus *forward azimuth* atau vektor arah 2D.
2. **Proyeksi ke Bibir Kotak Peta (Bounding Box Intersection):**
   Tarik garis dari koordinat target `(lat2, lng2)` ke arah asal hingga memotong batas *bounding box* peta Indonesia (`lat_min = -11.5`, `lat_max = 6.5`, `lng_min = 95.0`, `lng_max = 141.0`).
3. **Simpan Koordinat Perimeter di JSON:**
   Frontend tidak perlu pusing menghitung ulang geometri bola dunia; frontend cukup membaca `perimeter_entry: { lat, lng, sector }` dan menggambar busur tembakan dari tepi radar langsung ke titik kota di Indonesia.

---

## 4. Skema Data JSON Standar

### A. `data/summary.json`
Digunakan untuk mengisi kartu metrik atas, bar chart negara asal, distribusi tipe serangan, dan grafik tren 24 jam.

```json
{
  "updated_at": "2026-11-11T01:00:00Z",
  "defcon_level": 2,
  "sources": ["Cloudflare Radar (ID)", "abuse.ch Feodo/ThreatFox", "SANS DShield"],
  "metrics": {
    "mitigated_ddos_share_id": 68.4,
    "active_ioc_count": 412,
    "compromised_local_nodes": 19,
    "peak_bps_index": 94.2
  },
  "top_attack_origins": [
    { "country": "CN", "name": "China", "count": 1840, "share": 0.31 },
    { "country": "RU", "name": "Russia", "count": 1290, "share": 0.22 },
    { "country": "US", "name": "United States", "count": 980, "share": 0.16 },
    { "country": "BR", "name": "Brazil", "count": 610, "share": 0.10 },
    { "country": "VN", "name": "Vietnam", "count": 490, "share": 0.08 }
  ],
  "attack_types": [
    { "type": "SYN_FLOOD", "label": "L3/4 SYN Flood", "share": 0.38 },
    { "type": "HTTP_DDOS", "label": "L7 HTTP Flood", "share": 0.29 },
    { "type": "SSH_BRUTE", "label": "SSH Brute-Force (Port 22)", "share": 0.18 },
    { "type": "BOTNET_C2", "label": "Feodo/Mirai Botnet C2", "share": 0.15 }
  ],
  "trend_24h": [
    { "hour": "00:00", "intensity": 62 },
    { "hour": "01:00", "intensity": 78 },
    { "hour": "02:00", "intensity": 91 }
  ]
}
```

### B. `data/events.json`
Digunakan oleh mesin animasi Canvas untuk menembakkan busur serangan secara periodik dan mengisi tabel *Live IOC Telemetry* serta *Blocklist Exporter*.

```json
[
  {
    "id": "EVT-9081",
    "ts": "2026-11-11T00:58:12Z",
    "ip": "185.220.101.44",
    "asn": "AS205100",
    "org": "F3 Netze e.V.",
    "origin": {
      "country": "RU",
      "name": "Russia",
      "lat": 55.7558,
      "lng": 37.6173
    },
    "perimeter_entry": {
      "sector": "NORTH-WEST PERIMETER",
      "azimuth_deg": 324,
      "lat": 6.2000,
      "lng": 96.4000
    },
    "target": {
      "code": "JKT-IXP",
      "city": "Jakarta (IIX/OpenIXP)",
      "lat": -6.2088,
      "lng": 106.8456
    },
    "attack": {
      "type": "SYN_FLOOD",
      "protocol": "TCP/443",
      "severity": "CRITICAL",
      "abuse_score": 98
    },
    "source": "abuse.ch / CF-Radar"
  }
]
```

---

## 5. Struktur Direktori Repository

```text
garuda-sentinel/
├─ web/                         # Frontend Statis (Deploy ke Cloudflare Pages)
│  ├─ index.html                # Single-file atau modular UI
│  ├─ assets/
│  │  ├─ id-archipelago.geojson # GeoJSON poligon pulau Indonesia yang sudah di-simplify
│  │  └─ app.js                 # Engine radar Canvas + Fetcher JSON + Blocklist Exporter
├─ pipeline/                    # Script Python pengumpul data
│  ├─ requirements.txt          # requests, geoip2, maxminddb
│  ├─ fetch_radar.py            # Tarik tren DDoS Indonesia dari Cloudflare Radar API
│  ├─ fetch_abusech.py          # Tarik IOC Feodo Tracker & ThreatFox
│  ├─ enrich_geoip.py           # Translasi IP -> Koordinat + Hitung Perimeter Entry
│  └─ build_feeds.py            # Gabung semua ke summary.json, events.json, blocklist.rsc
├─ data/                        # Contoh output lokal / fallback JSON
│  ├─ summary.json
│  ├─ events.json
│  ├─ blocklist.txt
│  ├─ blocklist.csv
│  └─ blocklist-mikrotik.rsc
├─ .github/
│  └─ workflows/
│     └─ sync-telemetry.yml     # Cron job 15 menit (Push ke branch telemetry-data)
├─ rancangan_awal.md
├─ tech.md
└─ design.md
```

---

## 6. Konfigurasi GitHub Actions Anti-Polusi Commit (`.github/workflows/sync-telemetry.yml`)

Agar branch `main` tidak dipenuhi ribuan commit otomatis setiap bulan, workflow ini mem-push output JSON ke branch khusus `telemetry-data` menggunakan `--force` (hanya menyimpan 1 state terbaru). Frontend tinggal memanggil URL `raw.githubusercontent.com/<user>/<repo>/telemetry-data/data/events.json` atau melalui Cloudflare Pages build.

```yaml
name: Sync Threat Telemetry (15m)

on:
  schedule:
    - cron: '*/20 * * * *' # Jalan tiap 20 menit
  workflow_dispatch:       # Bisa di-trigger manual dari tab Actions

permissions:
  contents: write

jobs:
  build-telemetry:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Main Code
        uses: actions/checkout@v4

      - name: Setup Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install Dependencies
        run: pip install -r pipeline/requirements.txt

      - name: Run Intelligence Pipeline
        env:
          CF_RADAR_TOKEN: ${{ secrets.CF_RADAR_TOKEN }}
          ABUSEIPDB_KEY: ${{ secrets.ABUSEIPDB_KEY }}
        run: python pipeline/build_feeds.py

      - name: Deploy Data to Orphan Branch (telemetry-data)
        run: |
          git config user.name "garuda-sentinel-bot"
          git config user.email "bot@garuda-sentinel.local"
          git checkout --orphan temp-telemetry
          git rm -rf --cached .
          git add data/summary.json data/events.json data/blocklist.txt data/blocklist.csv data/blocklist-mikrotik.rsc
          git commit -m "chore(telemetry): sync threat feed $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
          git branch -M temp-telemetry telemetry-data
          git push origin telemetry-data --force
```
