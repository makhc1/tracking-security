# tracking-security

> **Garuda Sentinel // Indonesia Threat Watch**  
> Platform intelijen ancaman siber Indonesia real-time berspesifikasi pertahanan, memantau serangan masuk (inbound) ke infrastruktur digital nasional secara langsung dengan biaya infrastruktur Rp 0.

---

## ⚡ Fitur Utama

- **Live Inbound Telemetry**: Pelacakan serangan siber real-time berbasis OSINT terbuka (SANS ISC DShield, abuse.ch Feodo Tracker, CINS Army).
- **Tactical Archipelago Dot-Matrix Map**: Visualisasi SVG kepulauan Indonesia dengan arc serangan dinamis dan indikator gateway IXP (Batam, Jakarta, Surabaya, Bali, Makassar, Medan, Manado, Balikpapan).
- **24-Hour Trendline & Scrubber**: Grafik tren interaktif per jam dengan inspektor koordinat.
- **Top Attack Origins & Vectors**: Peringkat negara asal penyerang dan proporsi vektor serangan (Brute-Force SSH, DDoS Syn Flood, Botnet C2, Web Exploit, SQLi).
- **Automated Blocklist Feeds**: Ekspor blocklist otomatis dalam format Plain Text (`.txt`), CSV (`.csv`), dan MikroTik RouterOS Script (`.rsc`).
- **Military Grade Dark UI**: Palet warna tactical slate kebiruan (`#0D1217`), aksen teal (`#62C3B1`), serta tipografi modern Bricolage Grotesque & Figtree.

---

## 📁 Struktur Proyek

```
tracking-security/
├── .github/
│   └── workflows/
│       └── sync-telemetry.yml    # Cron sinkronisasi telemetri berkala (GitHub Actions)
├── pipeline/
│   ├── live_tracker.py           # Mesin pengumpul OSINT & GeoIP enrichment real-time
│   ├── enrich_geoip.py           # Utilitas kalkulasi azimuth dan boundary map
│   └── build_feeds.py            # Generator baseline telemetri offline
├── web/
│   ├── index.html                # Frontend visual dashboard
│   └── data/                     # Mirror data JSON & blocklist untuk frontend
├── data/                         # Berkas JSON telemetri & ekspor blocklist
├── design.md                     # Standar arsitektur & desain UI
├── tech.md                       # Spesifikasi teknis pipeline & stack
└── GEMINI.md                     # Panduan sistem dan antislop rules
```

---

## 🚀 Menjalankan Secara Lokal

### 1. Jalankan Frontend Web
```bash
python -m http.server 8080 --directory web
```
Buka browser di: `http://localhost:8080/index.html`

### 2. Jalankan Live Tracking Engine
```bash
python pipeline/live_tracker.py --watch
```
Engine akan memperbarui data ancaman langsung setiap 60 detik dari sensor OSINT.

---

## 🛡️ Lisensi & Hak Cipta
Dibuat untuk monitoring kedaulatan ruang siber Indonesia.
