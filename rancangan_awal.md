# Rancangan Awal: Garuda Sentinel // Indonesia Threat Watch (Budget Rp 0)

> Platform pemantauan dan intelijen ancaman siber publik yang berfokus pada ruang siber Indonesia. Dibangun di atas arsitektur statis tanpa biaya server (Rp 0) menggunakan agregasi sumber terbuka (OSINT) dan telemetri global.

---

## 1. Visi, Tujuan & Ruang Lingkup (Scope)

- **Tujuan Utama:** Menyediakan dashboard taktis edukatif bergaya pusat komando pertahanan (*Military-Grade Command Center*) yang memvisualisasikan tren serangan siber menuju Indonesia, sekaligus mendistribusikan *blocklist* IP berbahaya siap pakai (`.txt`, `.csv`, dan script firewall MikroTik `.rsc`).
- **Scope Geografis:** Peta terkunci 100% pada wilayah kedaulatan kepulauan Indonesia (Sabang sampai Merauke) dengan 8 titik simpul *Internet Exchange Point* (IXP) & pusat data nasional (Jakarta, Surabaya, Batam, Medan, Makassar, Denpasar, Balikpapan, Jayapura).
- **Solusi Visual Peta (Perimeter Entry Radar):** Karena kamera peta terfokus penuh di kepulauan Indonesia, serangan dari negara luar (mis. Rusia, Tiongkok, AS, Brasil) divisualisasikan masuk melalui **Titik Intersep Perimeter (Perimeter Entry Nodes)** di sepanjang batas tepi layar sesuai arah kompas/azimuth geografis negara asal menuju kota target di Indonesia.
- **Budget:** Rp 0. Tanpa VPS 24 jam, tanpa biaya database berbayar, dan tanpa koneksi WebSocket berbayar di Fase 1.

---

## 2. Pemisahan Peran Sumber Data (Mengatasi Bias IOC Global)

Agar data yang ditampilkan akurat secara teknis dan tidak mencampuradukkan daftar malware global dengan serangan yang menargetkan Indonesia, sumber data dibagi menjadi dua kategori tegas:

1. **Telemetri Serangan Masuk ke Indonesia (Inbound Volumetric & L7 Attacks)**
   - **Sumber:** **Cloudflare Radar API** (`location=ID`).
   - **Fungsi:** Menyediakan persentase tren serangan DDoS Layer 3/4 dan Layer 7 yang secara spesifik menargetkan jaringan Indonesia, termasuk daftar negara asal penyerang tertinggi (*Top Attack Origins*).

2. **Indikator Kompromi & Ancaman Aktif Lokal (Active Threat IOC & Botnet Feed)**
   - **Sumber:** **abuse.ch** (Feodo Tracker, URLhaus, ThreatFox), **SANS ISC DShield**, dan **AlienVault OTX**.
   - **Fungsi:** Mengambil feed IP *Botnet C2*, *Brute-Force*, dan distribusi malware, lalu memfilternya menjadi:
     - **External Threat Actors:** IP berbahaya global dari negara-negara yang tercatat di Top Origins Cloudflare Radar sebagai sampel riil untuk pembuatan *Blocklist*.
     - **Compromised Local Nodes (ID):** IP yang berlokasi di ASN/jaringan Indonesia (`country == "ID"`) yang terdeteksi menjadi bagian dari botnet atau menyebarkan malware—sangat krusial bagi sysadmin lokal untuk pembersihan jaringan domestik.

---

## 3. Fitur Utama (MVP -> Fase Lanjutan)

### MVP (Fase 1 - Statis & Otomatis)
- **Tactical Nusantara Radar Map:** Peta 2D kepulauan Indonesia dengan efek sapuan radar, *Perimeter Entry Nodes* di tepi layar untuk serangan lintas negara, dan animasi busur (*quadratic Bezier curve*) menuju 8 simpul kota Indonesia.
- **Panel Intelijen Komando:**
  - *Top Origin Countries* (Negara asal serangan tertinggi ke Indonesia).
  - *Attack Vector Distribution* (Rasio SYN Flood, UDP Flood, HTTP DDoS, SSH Brute-Force, Botnet C2).
  - *24-Hour Threat Intensity Trend* (Grafik tren jam-jaman).
- **Live Telemetry & IOC Feed Table:** Daftar IP berbahaya terbaru lengkap dengan ASN, negara asal, tipe ancaman, dan skor reputasi.
- **One-Click Blocklist Exporter:** Unduh daftar IP jahat langsung dalam format `.txt` (IP murni), `.csv` (lengkap dengan metadata), atau `.rsc` (script `address-list` siap *copy-paste* ke terminal RouterOS MikroTik).

### Fase 2 (Pengembangan Lanjutan)
- **Filter Taktis Interaktif:** Filter visualisasi berdasarkan jenis serangan, ASN tujuan, atau sumber intelijen.
- **Kamus Taktis Siber (Threat Encyclopedia):** Modal edukasi singkat mengenai cara kerja tiap serangan dan langkah mitigasinya di sisi server/router.
- **Integrasi Sensor Mandiri (Opsional):** Penambahan 1 node *low-interaction honeypot* (Cowrie/T-Pot) di VPS lokal Jakarta apabila ingin menggabungkan data publik dengan telemetri primer sendiri.

---

## 4. Etika, Lisensi & Disclaimer Publik

1. **Transparansi Sumber:** Setiap panel wajib mencantumkan label sumber data (`Cloudflare Radar`, `abuse.ch`, `DShield`) beserta stempel waktu pembaruan terakhir (`LAST INTEL SYNC: UTC / WIB`).
2. **Bukan Representasi Absolut:** Cantumkan secara jelas bahwa visualisasi pada peta adalah *playback* terkalibrasi dari data agregat dan sampel IOC periodik (diperbarui setiap 15-30 menit), bukan sadapan paket *real-time* dari backbone nasional.
3. **Disclaimer IP Korban:** Berikan catatan bahwa alamat IP yang tercantum di dalam *blocklist* bisa merupakan server atau perangkat IoT milik pihak ketiga yang telah dikompromikan (*botnet node*), bukan selalu lokasi fisik pelaku di balik layar.
