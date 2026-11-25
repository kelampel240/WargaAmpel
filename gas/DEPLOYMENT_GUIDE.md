# Panduan Instalasi & Deployment WARGA AMPEL (Google Drive, Google Sheets, Apps Script & GitHub Pages)

## 1. Menghubungkan Google Drive (`SIWARGA_DESA`)
Folder Google Drive Anda sudah terdaftar pada konfigurasi default:
- **Link Folder:** `https://drive.google.com/drive/folders/1gT7JFuHwe2LYhJp2BlZeQ9j5tgLC2IJx`
- **Root Folder ID:** `1gT7JFuHwe2LYhJp2BlZeQ9j5tgLC2IJx`

**Catatan Keamanan Lintas Lokasi/Email:**
- Setel akses folder `1gT7JFuHwe2LYhJp2BlZeQ9j5tgLC2IJx` menjadi **Restricted / Privat** (cukup akun pengelola pusat yang menjadi Pemilik/Editor; warga tidak perlu diberi akses Drive langsung). Foto profil pengurus yang ditandai publik akan otomatis disimpan pada subfolder `06_FOTO_ORGANISASI`.

## 2. Membuat & Menghubungkan Google Sheets (`DATABASE_SIWARGA`)
1. Buka Google Drive menggunakan **akun pengelola utama**.
2. Di dalam folder atau Drive utama, buat Google Spreadsheet baru bernama **`DATABASE_SIWARGA`**.
3. Salin **Spreadsheet ID** dari URL browser:
   `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`
4. Dari Spreadsheet tersebut, buka menu **Extensions → Apps Script**.

## 3. Memasang Kode Google Apps Script
1. Di editor Apps Script, pastikan 4 berkas berikut sudah diisi dengan kode terbaru dari folder `/gas/`:
   - `Code.gs` (Backend modular + `LockService` + Drive & Sheets handler + Portal Struktur Organisasi)
   - `SetupDatabase.gs` (Pembuat 17 tab + header + akun Super Admin default + layanan awal + struktur organisasi)
   - `SetupDrive.gs` (Pembuat 6 subfolder di dalam folder `1gT7JFuHwe2LYhJp2BlZeQ9j5tgLC2IJx`)
   - `Frontend.html` (Tampilan HTML5 mandiri opsional)
2. Pastikan bagian atas `Code.gs` sudah terisi:
   ```javascript
   var CONFIG = {
     SPREADSHEET_ID: 'TEMPEL_ID_SPREADSHEET_DATABASE_SIWARGA',
     ROOT_FOLDER_ID: '1gT7JFuHwe2LYhJp2BlZeQ9j5tgLC2IJx',
     DEPLOYMENT_ID: 'AKfycbynL1cGsXjMkFrOuJBRq97Dgd8N3zhNV2iG3jtTD9JOB1xbIugOMcptY-2aJbVbnWajoQ',
     WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbynL1cGsXjMkFrOuJBRq97Dgd8N3zhNV2iG3jtTD9JOB1xbIugOMcptY-2aJbVbnWajoQ/exec',
     NAMA_DESA: 'Kelurahan Ampel',
     ...
   };
   ```
3. Jalankan fungsi **`setupDatabase`** (izinkan akses OAuth saat diminta Google).
4. Jalankan fungsi **`setupDriveFolders`** untuk membentuk 6 subfolder (`01_LAPORAN_WARGA` s.d. `06_FOTO_ORGANISASI`) secara otomatis di Google Drive Anda.

## 4. Deployment Google Apps Script Web App
- **Deployment ID Terdaftar:** `AKfycbynL1cGsXjMkFrOuJBRq97Dgd8N3zhNV2iG3jtTD9JOB1xbIugOMcptY-2aJbVbnWajoQ`
- **Web App URL Terdaftar:** `https://script.google.com/macros/s/AKfycbynL1cGsXjMkFrOuJBRq97Dgd8N3zhNV2iG3jtTD9JOB1xbIugOMcptY-2aJbVbnWajoQ/exec`

Pastikan saat **Deploy → Manage deployments → Edit (atau New deployment)**:
1. Pilih jenis **Web app**.
2. **Execute as:** pilih **`Me`** *(akun pemilik database)* agar akses Sheets & Drive selalu berjalan aman di bawah otoritas kelurahan.
3. **Who has access:** pilih **`Anyone`** *(wajib, bukan "Only myself")* agar aplikasi web GitHub Pages & warga di lokasi/email berbeda tidak terkena HTTP 403.

## 5. Publikasi Link Warga via GitHub Pages (`github.io`)
Workflow `.github/workflows/deploy-pages.yml` sudah dikonfigurasi menggunakan URL Web App GAS Anda sebagai default.
1. Unggah seluruh proyek ini ke repository GitHub Anda (branch `main`).
2. *(Opsional jika ingin mengganti URL tanpa edit kode)*: di **Settings → Secrets and variables → Actions → Variables**, tambahkan `VITE_GAS_WEB_APP_URL`.
3. Buka **Settings → Pages → Build and deployment**, ubah **Source** menjadi **`GitHub Actions`**.
4. Jalankan workflow `.github/workflows/deploy-pages.yml` (atau push ke `main`). Link HTTP/HTTPS resmi di `https://<username>.github.io/<nama-repo>/` siap dibagikan kepada warga!

## 6. Akun Login Default (Setelah `setupDatabase`)
- **Username:** `admin`
- **Kata Sandi:** `AdminAmpel2026!` *(segera ubah setelah masuk pertama kali)*
