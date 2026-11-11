# Panduan Desain: Indonesia Threat Watch (`design.md`)

> Sistem desain antarmuka **Indonesia Threat Watch // Garuda Sentinel**. Mengadopsi estetika dasbor intelijen ancaman siber publik yang bersih, elegan, dan informatif dengan dominasi warna **Slate Kebiruan** di atas latar **Gelap/Terang Adaptif** dengan aksen tunggal **Hijau Laut (Teal)**.

---

## 1. Filosofi Visual (Aesthetic Direction)

1. **Editorial Intelligence & Keterbacaan Tinggi:** Mengutamakan kenyamanan membaca data teknis (*telemetry & threat intelligence*) tanpa ornamen militer yang berlebihan. Menggunakan sudut melengkung halus (`border-radius: 12px`), garis tepi tipis solid (`border: 1px solid var(--line)`), dan hierarki visual yang jelas.
2. **Palet Slate Kebiruan & Aksen Hijau Laut:**
   - Latar utama menggunakan warna slate gelap pekat (`#0D1217`) dengan permukaan kartu (`#131A21`).
   - Aksen tunggal hijau laut (*Sea-Green Teal* `#62C3B1`) untuk elemen aktif, aliran serangan pada peta, dan data interaktif.
   - Warna merah (`#E8727C`) dan kuning amber (`#E0A64B`) digunakan secara ketat hanya untuk indikator keparahan (*threat severity / risk score*), bukan untuk dekorasi.
3. **Peta Titik Wawasan Nusantara (Dot-Matrix Archipelago):** Peta kepulauan Indonesia digambar dengan kumpulan titik-titik diskret (*dot matrix*) diiringi busur lengkung Bezier halus bergaris putus-putus mengalir (*flowing dash*) dari negara asal menuju Jakarta sebagai simpul acuan nasional.
4. **Dukungan Tema Ganda (Dark / Light Mode):** Antarmuka mendukung mode gelap (*dark mode*) dan mode terang (*light mode*) dengan transisi halus dan persistensi preferensi di `localStorage`.

---

## 2. Palet Warna (Color Tokens)

### Mode Gelap (Dark Mode - Default)
| Token | Hex Code | Peran Penggunaan |
|---|---|---|
| `--bg` | `#0D1217` | Latar belakang halaman utama (Dark Slate). |
| `--surface` | `#131A21` | Latar belakang kartu panel utama. |
| `--surface-2` | `#18212A` | Latar belakang trek progres bar, hover baris tabel, dan elemen sekunder. |
| `--line` | `#243039` | Garis tepi panel dan pembatas tabel. |
| `--fg` | `#E6ECF0` | Warna teks utama dan angka metrik. |
| `--fg-2` | `#9AA8B3` | Teks keterangan, label kolom, dan metadata. |
| `--fg-3` | `#7A8895` | Teks petunjuk halus, tick grafik, dan catatan kaki. |
| `--accent` | `#62C3B1` | Warna aksen utama (Sea-Green Teal) untuk busur peta, tombol utama, dan indikator aktif. |
| `--accent-ink`| `#06201B` | Teks kontras tinggi di atas latar `--accent`. |
| `--dot` | `#1F2B34` | Titik-titik daratan kepulauan Indonesia pada peta. |
| `--warn` | `#E0A64B` | Peringatan risiko sedang (reputasi 50–79). |
| `--crit` | `#E8727C` | Peringatan risiko kritis (reputasi 80–100). |

### Kategori Warna Serangan
- `--c1` (`#62C3B1`): DDoS / SYN Flood
- `--c2` (`#6FA8E8`): Brute-Force / SSH
- `--c3` (`#E0A64B`): Pemindaian Port
- `--c4` (`#D98BB0`): Botnet Command & Control (C2)
- `--c5` (`#A79BE0`): Distribusi URL Malware / Exploit
- `--c6` (`#8FA0AD`): Defacement / Lainnya

---

## 3. Tipografi (Typography System)

- **Display & Judul Panel:** `Bricolage Grotesque` (Weights: 600, 700). Memberikan identitas kontemporer yang khas, ramah, namun tegas dan profesional.
- **Teks Konten & Antarmuka:** `Figtree` (Weights: 400, 500, 600). Keterbacaan tinggi pada berbagai ukuran layar.
- **Data Numerik, IP Address & Waktu:** `ui-monospace`, `SF Mono`, `Menlo`, `Consolas` dengan `font-variant-numeric: tabular-nums`.

---

## 4. Tata Letak (Page Layout)

Halaman menggunakan kontainer terpusat `max-width: 1180px` yang responsif dari layar ponsel hingga monitor desktop:

```text
+-----------------------------------------------------------------------------------+
| [BRAND ICON] Indonesia Threat Watch    [BADGE: DATA LANGSUNG] [JAM WIB] [TEMA]   | <- Top Header
+---------------------------------------------------+-------------------------------+
|                                                   |  RINGKASAN 24 JAM             |
|  PETA ASAL SERANGAN                               |  - Total Kejadian (Big Num)   |
|  - Dotted Archipelago Map of Indonesia            |  - Asal Terbanyak             |
|  - Animated Curved Flow Arcs from Origin Chips    |  - Jenis Terbanyak            |
|  - Pulsing Target Hub (Jakarta)                   |  - Jam Tersibuk (WIB)         |
|                                                   |  - Sumber Aktif               |
+--------------------------+------------------------+-------------------------------+
|  KEJADIAN PER JAM        |  NEGARA ASAL TERBANYAK |  JENIS SERANGAN               |
|  - SVG Interactive Trend |  - Progress Bars       |  - Proportional Stack Bar     |
|  - Hover Scrubber Cursor |  - Total Count & Name  |  - Color Legend & Percentage  |
+--------------------------+------------------------+-------------------------------+
|  FEED IP TERBARU DARI TELEMETRI                                                   |
|  - Filter Chips: [Semua] [DDoS] [Brute force] [Port Scan] [Botnet C2] [Malware]  |
|  - Action Buttons: [Salin blocklist] [.CSV] [MikroTik .RSC]                       |
|  - Data Table: Waktu (relatif), IP, Asal, ASN, Jenis (dot), Sumber, Skor Reputasi|
+-----------------------------------------------------------------------------------+
|  TENTANG DATA: SUMBER INTELIJEN & CARA MEMBACA TELEMETRI                          |
+-----------------------------------------------------------------------------------+
```

---

## 5. Fitur Interaktif

1. **Peta Interaktif:** Tooltip detail kejadian saat kursor diarahkan ke chip negara asal penyerang.
2. **Grafik Tren Hover Scrubber:** Menggerakkan kursor di atas grafik SVG akan menggeser garis penunjuk waktu dan memperbarui teks ringkasan (*"XXX kejadian pada HH:00 WIB"*).
3. **Filter Jenis Serangan:** Klik chip kategori serangan untuk memfilter isi tabel IP seketika.
4. **Eksportir Blocklist Multi-Format:**
   - Salin instan ke papan klip (*clipboard*).
   - Ekspor data lengkap format `.csv`.
   - Ekspor script firewall MikroTik RouterOS `.rsc` siap pakai.
