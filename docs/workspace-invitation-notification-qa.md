# QA Workspace, Invitation, dan Notification

Tanggal: 18 Oktober 2026. Target: aplikasi lokal `http://localhost:3002/`, PostgreSQL `nexusops_taskmanager`.

## Hasil akhir

Temuan yang direproduksi pada tahap awal sudah diperbaiki dan dikunci dengan regresi. Tidak ada temuan Blocker, High, Medium, atau Low yang masih terbuka pada skenario yang diuji. Ini hasil untuk cakupan di bawah, bukan jaminan bahwa seluruh aplikasi tidak memiliki bug.

Akun serta workspace uji dibuat khusus dan dibersihkan oleh setiap skrip melalui blok `finally`. Pengujian tidak mengundang pengguna sungguhan, tidak mengirim email, dan tidak mengubah isi task pengguna. Notification bersifat **pending actions**, bukan sistem histori read/unread: item selesai ketika undangan diselesaikan atau task tidak lagi membutuhkan perhatian.

## Bukti dan batas pemeriksaan

Pengujian server memakai HTTP nyata, session pengguna, dan PostgreSQL. Pengujian notification server mengambil data workspace/invitation melalui API lalu menjalankan model notification yang sama dengan UI. Rendering tombol dan isi inbox diuji terpisah; browser desktop memverifikasi tombol, count, inbox kosong, indikator, dan klik di luar untuk menutup. Jalur popup penerima undangan dengan akun uji tidak dijalankan dalam sesi browser pengguna; alur penerimaan undangannya diuji melalui HTTP nyata dan konten UI melalui render tests. Mobile dan pembaca layar khusus belum diuji langsung.

## Temuan awal dan penyelesaiannya

| Temuan awal | Hasil perbaikan | Bukti |
| --- | --- | --- |
| Medium: proyek lama tertahan selama perpindahan workspace | `switchWorkspace` mengosongkan proyek, pilihan proyek, task, event, dan actor sebelum fetch tujuan | Dua tes transisi/race pada `tests/workspace-client.test.ts` lulus |
| Medium: undangan tidak masuk ke lonceng | Inbox memasukkan undangan aktif dan membuka WorkspacePicker untuk accept/decline | `tests/notifications.test.ts`, `scripts/notifications-smoke.ts`, dan alur invitation pada `scripts/workspace-smoke.ts` lulus |
| Low: indikator menyala pada inbox kosong | Dot hanya dirender bila ada pending action; tombol menyebut count serta `aria-expanded` | Render test dan browser menunjukkan `Notifications: 0 pending actions` tanpa dot; screenshot `/tmp/nexusops-notifications-verified.png` |
| Low: tes mengharapkan API agent yang sudah dihentikan | Tes API diganti untuk external-worker claim, telemetry, review, approval, deprecation 410, dan concurrency | `tests/api.test.ts` lulus; tes protocol circuit-breaker tetap dipertahankan |

## Cakupan yang lulus

### Workspace dan invitation — 15 kelompok skenario

`npm run test:workspaces` memeriksa pembuatan banyak workspace kosong, admin awal, akses non-member, invite role member/admin, normalisasi huruf email, duplikat, pencocokan penerima, accept eksplisit, replay, task/komentar bersama, batas member, admin terakhir, promosi/demote, rename, expiry, reissue, remove/revoke, penerima belum terdaftar, input invalid, decline, concurrent invite/accept/admin demotion, dan CSRF.

Permintaan bersamaan tidak menciptakan undangan atau membership ganda. Dua admin yang menurunkan role secara bersamaan tetap menyisakan satu admin. Anggota yang dikeluarkan langsung kehilangan akses API tanpa menghapus task bersama.

### Notification — 3 kelompok server dan 4 tes model/render

`npm run test:notifications` memeriksa undangan muncul lalu hilang setelah expiry, revoke, decline, dan accept; task Testing dari dua proyek pada workspace aktif muncul bersamaan; workspace pribadi tetap kosong; task Done menghapus item; member yang dikeluarkan tidak dapat membaca data workspace lama.

Inbox juga memasukkan task Blocked yang membutuhkan perhatian, menolak task dari proyek di luar snapshot workspace, dan menyertakan nama proyek. Klik task pada inbox memilih proyek terkait sebelum membuka inspector. Klik undangan membuka daftar workspace/invitations. Dot dan hitungan menggunakan sumber item yang sama. Pembaruan mengikuti refresh aplikasi yang sudah ada, bukan push/WebSocket.

### Isolasi — 7 kelompok skenario

`npm run test:isolation`: akun baru kosong, proyek bernama sama tetap terpisah, task/event/identitas tidak lintas akun, spoofed owner/workspace header, deduplikasi source per proyek, edit task/attachment/project reference lintas akun ditolak, dan hitungan PostgreSQL sesuai API.

### Autentikasi — 14 pemeriksaan

`npm run test:auth`: guest redirect/API denial, register/session, password hash, duplicate email, invalid login, CSRF registration/logout, revocation session, login/rotation, expiry, dan satu identitas manusia per akun.

### Gate regresi

- `npm test`: **37/37 lulus**, tanpa skip.
- `npm run typecheck`: lulus.
- `NEXUS_BUILD_DIR=.next-build npm run build`: lulus.
- `git diff --check`: lulus.

## Lokasi implementasi

| File | Peran |
| --- | --- |
| `lib/client.ts` | Pembersihan cache workspace dan penjagaan stale response |
| `lib/notifications.ts` | Model inbox: undangan aktif, task lintas proyek workspace aktif, expiry dan filtering |
| `components/notifications.tsx` | Tombol, count, popover, keyboard Escape, outside click, dan dispatch item |
| `components/workspace.tsx` | Navigasi dari notification menuju proyek/task atau WorkspacePicker |
| `scripts/workspace-smoke.ts` | HTTP regression role, invitation, concurrency dan kolaborasi |
| `scripts/notifications-smoke.ts` | Notification dengan data HTTP/PostgreSQL nyata |
| `scripts/isolation-smoke.ts` | Isolasi akun, task, proyek dan attachment |
| `tests/workspace-client.test.ts` | Regresi transisi workspace dan stale responses |
| `tests/notifications.test.ts` | Regresi filtering, count, rendering dan indikator |

## Terminologi dan risiko tersisa

Istilah inbox dijelaskan lewat accessible name sebagai jumlah **pending actions**. Status Testing memetakan ke state internal `WAITING_HUMAN`; Blocked tetap memerlukan perhatian. Undangan tetap in-app dan tidak mengirim email.

Tidak ditemukan masalah tambahan pada kategori role, akses workspace, dan lifecycle undangan dalam skenario yang diperiksa. Sisa batas verifikasi adalah perangkat mobile, assistive technology khusus, jaringan putus jangka panjang, serta beban besar; hasil ini tidak membuat klaim untuk kasus-kasus tersebut.
