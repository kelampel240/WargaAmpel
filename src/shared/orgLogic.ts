import {
  AdminOrgStructureResponse,
  OrgPublicProfile,
  OrgSectionKey,
  PublicOrgStructureResponse,
  SheetPengaturan,
  SiwargaDatabase,
} from './types';

const EMPTY_PHONE_PLACEHOLDERS = new Set([
  '',
  '-',
  '--',
  '---',
  '0',
  'tidak ada',
  'belum ada',
  'kosong',
  'n/a',
  'na',
  'null',
  'none',
  'nihil',
  't/a',
]);

export function normalizeIndonesianPhone(phone?: string | number | null): string {
  if (phone === null || phone === undefined) return '';
  let raw =
    typeof phone === 'number'
      ? Number.isFinite(phone)
        ? String(Math.trunc(phone))
        : ''
      : String(phone);

  raw = raw.trim().replace(/^'+/, '').trim();
  if (!raw || EMPTY_PHONE_PLACEHOLDERS.has(raw.toLowerCase())) {
    return '';
  }

  // Jika ada lebih dari satu nomor dipisahkan '/', ',', atau ';', ambil kandidat utama terlebih dahulu
  if (/[\/,;]/.test(raw)) {
    const parts = raw
      .split(/[\/,;]+/)
      .map((p) => p.trim())
      .filter((p) => p && !EMPTY_PHONE_PLACEHOLDERS.has(p.toLowerCase()));
    raw = parts[0] || '';
  }

  const cleaned = raw.replace(/[\s\-().\u00A0\u200B]+/g, '');
  if (!cleaned || EMPTY_PHONE_PLACEHOLDERS.has(cleaned.toLowerCase())) {
    return '';
  }

  // Format salah ketik 6208... / +6208... -> 08...
  if (/^\+?620[1-9][0-9]{6,13}$/.test(cleaned)) {
    return `0${cleaned.replace(/^\+?620/, '')}`;
  }
  // Format internasional +628... / 628... -> +628... / 628... tetap valid,
  // atau ubah +62 / 62 agar seragam dengan nomor lokal bila diawali 62
  if (/^\+62[2-9][0-9]{6,13}$/.test(cleaned)) {
    return `0${cleaned.slice(3)}`;
  }
  if (/^62[2-9][0-9]{6,13}$/.test(cleaned)) {
    return `0${cleaned.slice(2)}`;
  }
  // Excel / Google Sheets sering menghapus angka 0 di depan (81234567890 -> 081234567890)
  if (/^8[1-9][0-9]{6,12}$/.test(cleaned)) {
    return `0${cleaned}`;
  }
  // Nomor telepon rumah/kantor tanpa angka 0 di depan (mis. 318889999 -> 0318889999)
  if (/^[2-79][0-9]{7,12}$/.test(cleaned)) {
    return `0${cleaned}`;
  }

  return cleaned;
}

export function cleanPhoneRaw(phone?: string | number | null): string {
  return normalizeIndonesianPhone(phone);
}

export function isValidIndonesianPhone(phone?: string | number | null): boolean {
  const cleaned = normalizeIndonesianPhone(phone);
  if (!cleaned) return true; // Nomor HP opsional
  return (
    /^(\+62|62|0)8[1-9][0-9]{6,12}$/.test(cleaned) ||
    /^(\+62|62|0)[2-9][0-9]{7,12}$/.test(cleaned)
  );
}

export function toWhatsAppDigits(phone?: string | number | null): string {
  const normalized = normalizeIndonesianPhone(phone);
  const digits = normalized.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return `62${digits}`;
}

export function buildWhatsAppUrl(phone: string | undefined, tampilkanHp: boolean): string | null {
  if (!tampilkanHp) return null;
  const cleaned = normalizeIndonesianPhone(phone);
  if (!cleaned || !isValidIndonesianPhone(cleaned)) return null;
  const waDigits = toWhatsAppDigits(cleaned);
  if (waDigits.length < 10) return null;
  return `https://wa.me/${waDigits}`;
}

export function buildMapsUrl(customUrl: string | undefined, fallbackQuery: string): string | undefined {
  const trimmed = String(customUrl || '').trim();
  if (trimmed && /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const q = fallbackQuery.trim();
  if (!q) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export type OrgEntityType =
  | 'kelurahan'
  | 'lpmk'
  | 'rw'
  | 'rt'
  | 'kader'
  | 'sekolah'
  | 'guru'
  | 'balai_rw';

export function validateOrgInput(
  entity: OrgEntityType,
  payload: Record<string, unknown>,
  db: Pick<SiwargaDatabase, 'ORG_RW' | 'ORG_RT' | 'ORG_SEKOLAH'>
): string | null {
  const noHp = normalizeIndonesianPhone(payload.noHp as string | number | undefined);
  if (noHp && !isValidIndonesianPhone(noHp)) {
    return 'Format nomor HP Indonesia tidak valid (contoh: 081234567890 atau +6281234567890).';
  }

  if (entity === 'sekolah') {
    const namaSekolah = String(payload.namaSekolah ?? payload.nama ?? '').trim();
    const jenjang = String(payload.jenjang ?? '').trim();
    const alamat = String(payload.alamat ?? '').trim();
    if (namaSekolah.length < 2) {
      return 'Nama sekolah wajib diisi minimal 2 karakter.';
    }
    if (!jenjang) {
      return 'Jenjang pendidikan sekolah wajib dipilih.';
    }
    if (alamat.length < 5) {
      return 'Alamat lokasi sekolahan wajib diisi minimal 5 karakter.';
    }
    return null;
  }

  if (entity === 'guru') {
    const nama = String(payload.nama ?? '').trim();
    const jabatan = String(payload.jabatan ?? '').trim();
    const idSekolah = String(payload.idSekolah ?? '').trim();
    if (nama.length < 2) {
      return 'Nama guru wajib diisi minimal 2 karakter.';
    }
    if (jabatan.length < 2) {
      return 'Mata pelajaran atau jabatan guru wajib diisi minimal 2 karakter.';
    }
    if (!idSekolah || !(db.ORG_SEKOLAH || []).some((s) => s.ID_SEKOLAH === idSekolah)) {
      return 'Guru wajib terhubung ke salah satu sekolah yang terdaftar.';
    }
    return null;
  }

  if (entity === 'balai_rw') {
    const namaBalai = String(payload.namaBalai ?? payload.nama ?? '').trim();
    const alamat = String(payload.alamat ?? '').trim();
    const idRw = String(payload.idRw ?? '').trim();
    if (!idRw || !db.ORG_RW.some((r) => r.ID_RW === idRw)) {
      return 'Balai RW wajib terhubung ke salah satu RW yang terdaftar.';
    }
    if (namaBalai.length < 2) {
      return 'Nama Balai RW wajib diisi minimal 2 karakter.';
    }
    if (alamat.length < 5) {
      return 'Alamat Balai RW wajib diisi minimal 5 karakter.';
    }
    return null;
  }

  const nama = String(
    entity === 'rw' || entity === 'rt' ? payload.namaKetua ?? payload.nama ?? '' : payload.nama ?? ''
  ).trim();
  const jabatan = String(payload.jabatan ?? '').trim();

  if (nama.length < 2) {
    return 'Nama wajib diisi minimal 2 karakter.';
  }
  if (jabatan.length < 2) {
    return 'Jabatan wajib diisi minimal 2 karakter.';
  }

  if (entity === 'rw') {
    const nomorRw = String(payload.nomorRw ?? '').trim();
    const wilayah = String(payload.wilayahTugas ?? '').trim();
    if (!nomorRw) return 'Nomor RW wajib diisi (contoh: RW 01).';
    if (!wilayah) return 'Wilayah tugas RW wajib diisi.';
  }

  if (entity === 'rt') {
    const idRw = String(payload.idRw ?? '').trim();
    const nomorRt = String(payload.nomorRt ?? '').trim();
    if (!idRw || !db.ORG_RW.some((r) => r.ID_RW === idRw)) {
      return 'RT wajib terhubung ke salah satu RW yang terdaftar.';
    }
    if (!nomorRt) return 'Nomor RT wajib diisi (contoh: RT 01).';
  }

  if (entity === 'kader') {
    const idRt = String(payload.idRt ?? '').trim();
    if (!idRt || !db.ORG_RT.some((r) => r.ID_RT === idRt)) {
      return 'Kader wajib terhubung ke salah satu RT yang terdaftar.';
    }
  }

  return null;
}

const DEFAULT_SECTION_ORDER: OrgSectionKey[] = [
  'KELURAHAN',
  'LPMK_RW_RT',
  'KADER',
  'SEKOLAH_GURU',
  'BALAI_RW',
];

export function extractOrgDisplaySettings(
  pengaturan: SheetPengaturan[]
): PublicOrgStructureResponse['displaySettings'] {
  const getVal = (key: string, fallback: string) =>
    pengaturan.find((p) => p.KUNCI === key)?.NILAI ?? fallback;

  let urutanBagian: OrgSectionKey[] = [...DEFAULT_SECTION_ORDER];
  try {
    const parsed = JSON.parse(getVal('ORG_URUTAN_BAGIAN', '[]'));
    if (Array.isArray(parsed) && parsed.length > 0) {
      const validSet = parsed.filter((item): item is OrgSectionKey =>
        DEFAULT_SECTION_ORDER.includes(item as OrgSectionKey)
      );
      for (const fallbackKey of DEFAULT_SECTION_ORDER) {
        if (!validSet.includes(fallbackKey)) {
          validSet.push(fallbackKey);
        }
      }
      urutanBagian = validSet;
    }
  } catch {
    // use default order
  }

  let tampilkanBagian = {
    kelurahan: true,
    lpmk: true,
    rwRt: true,
    kader: true,
    sekolahGuru: true,
    balaiRw: true,
  };
  try {
    const parsed = JSON.parse(getVal('ORG_TAMPILKAN_BAGIAN', '{}'));
    if (parsed && typeof parsed === 'object') {
      tampilkanBagian = {
        kelurahan: parsed.kelurahan !== false,
        lpmk: parsed.lpmk !== false,
        rwRt: parsed.rwRt !== false,
        kader: parsed.kader !== false,
        sekolahGuru: parsed.sekolahGuru !== false,
        balaiRw: parsed.balaiRw !== false,
      };
    }
  } catch {
    // use default visibility
  }

  return {
    pengumumanBeranda: getVal(
      'ORG_PENGUMUMAN',
      'Informasi pengurus, struktur organisasi, fasilitas pendidikan, dan Balai RW di Warga Ampel diperbarui secara berkala oleh Pemerintah Kelurahan.'
    ),
    urutanBagian,
    tampilkanBagian,
  };
}

export function sanitizePublicOrgData(db: SiwargaDatabase): PublicOrgStructureResponse {
  const displaySettings = extractOrgDisplaySettings(db.PENGATURAN);
  const rwMap = new Map(db.ORG_RW.map((r) => [r.ID_RW, r]));
  const rtMap = new Map(db.ORG_RT.map((r) => [r.ID_RT, r]));

  const kelurahan: OrgPublicProfile[] = db.ORG_KELURAHAN
    .filter((k) => k.AKTIF && k.TAMPILKAN_PUBLIK)
    .sort((a, b) => a.URUTAN - b.URUTAN)
    .map((k) => {
      const allowHp = Boolean(k.TAMPILKAN_HP);
      const waUrl = buildWhatsAppUrl(k.NO_HP, allowHp);
      return {
        id: k.ID_KELURAHAN,
        kategori: 'KELURAHAN',
        nama: k.NAMA,
        jabatan: k.JABATAN,
        tingkat: k.TINGKAT,
        wilayahTugas: k.WILAYAH_TUGAS,
        fotoUrl: k.FOTO_URL || undefined,
        noHp: allowHp && k.NO_HP ? k.NO_HP : undefined,
        waUrl,
        tampilkanHp: allowHp,
        urutan: k.URUTAN,
      };
    });

  const lpmk: OrgPublicProfile[] = db.ORG_LPMK
    .filter((l) => l.AKTIF && l.TAMPILKAN_PUBLIK)
    .sort((a, b) => a.URUTAN - b.URUTAN)
    .map((l) => {
      const allowHp = Boolean(l.TAMPILKAN_HP);
      return {
        id: l.ID_LPMK,
        kategori: 'LPMK',
        nama: l.NAMA,
        jabatan: l.JABATAN,
        bidang: l.BIDANG,
        fotoUrl: l.FOTO_URL || undefined,
        noHp: allowHp && l.NO_HP ? l.NO_HP : undefined,
        waUrl: buildWhatsAppUrl(l.NO_HP, allowHp),
        tampilkanHp: allowHp,
        urutan: l.URUTAN,
      };
    });

  const activeRwList = db.ORG_RW
    .filter((r) => r.AKTIF && r.TAMPILKAN_PUBLIK)
    .sort((a, b) => a.URUTAN - b.URUTAN);
  const activeRwSet = new Set(activeRwList.map((r) => r.ID_RW));

  const rw: OrgPublicProfile[] = activeRwList.map((r) => {
    const allowHp = Boolean(r.TAMPILKAN_HP);
    return {
      id: r.ID_RW,
      kategori: 'RW',
      nama: r.NAMA_KETUA,
      jabatan: r.JABATAN,
      nomorRw: r.NOMOR_RW,
      idRw: r.ID_RW,
      wilayahTugas: r.WILAYAH_TUGAS,
      fotoUrl: r.FOTO_URL || undefined,
      noHp: allowHp && r.NO_HP ? r.NO_HP : undefined,
      waUrl: buildWhatsAppUrl(r.NO_HP, allowHp),
      tampilkanHp: allowHp,
      urutan: r.URUTAN,
    };
  });

  const activeRtList = db.ORG_RT
    .filter((t) => t.AKTIF && t.TAMPILKAN_PUBLIK && activeRwSet.has(t.ID_RW))
    .sort((a, b) => a.URUTAN - b.URUTAN);
  const activeRtSet = new Set(activeRtList.map((t) => t.ID_RT));

  const rt: OrgPublicProfile[] = activeRtList.map((t) => {
    const parentRw = rwMap.get(t.ID_RW);
    const allowHp = Boolean(t.TAMPILKAN_HP);
    return {
      id: t.ID_RT,
      kategori: 'RT',
      nama: t.NAMA_KETUA,
      jabatan: t.JABATAN,
      idRw: t.ID_RW,
      idRt: t.ID_RT,
      nomorRw: parentRw?.NOMOR_RW || '-',
      nomorRt: t.NOMOR_RT,
      wilayahTugas: t.WILAYAH_TUGAS,
      fotoUrl: t.FOTO_URL || undefined,
      noHp: allowHp && t.NO_HP ? t.NO_HP : undefined,
      waUrl: buildWhatsAppUrl(t.NO_HP, allowHp),
      tampilkanHp: allowHp,
      urutan: t.URUTAN,
    };
  });

  const kader: OrgPublicProfile[] = db.ORG_KADER
    .filter((k) => k.AKTIF && k.TAMPILKAN_PUBLIK && activeRtSet.has(k.ID_RT))
    .sort((a, b) => a.URUTAN - b.URUTAN)
    .map((k) => {
      const parentRt = rtMap.get(k.ID_RT);
      const parentRw = parentRt ? rwMap.get(parentRt.ID_RW) : undefined;
      const allowHp = Boolean(k.TAMPILKAN_HP);
      return {
        id: k.ID_KADER,
        kategori: 'KADER',
        nama: k.NAMA,
        jabatan: k.JABATAN,
        idRt: k.ID_RT,
        idRw: parentRt?.ID_RW,
        nomorRt: parentRt?.NOMOR_RT || '-',
        nomorRw: parentRw?.NOMOR_RW || '-',
        wilayahTugas:
          parentRw && parentRt ? `${parentRw.NOMOR_RW} · ${parentRt.NOMOR_RT}` : parentRt?.NOMOR_RT || '',
        fotoUrl: k.FOTO_URL || undefined,
        noHp: allowHp && k.NO_HP ? k.NO_HP : undefined,
        waUrl: buildWhatsAppUrl(k.NO_HP, allowHp),
        tampilkanHp: allowHp,
        urutan: k.URUTAN,
      };
    });

  const rawSekolah = db.ORG_SEKOLAH || [];
  const rawGuru = db.ORG_GURU || [];
  const rawBalaiRw = db.ORG_BALAI_RW || [];

  const activeSekolahList = rawSekolah
    .filter((s) => s.AKTIF && s.TAMPILKAN_PUBLIK)
    .sort((a, b) => a.URUTAN - b.URUTAN);
  const sekolahMap = new Map(activeSekolahList.map((s) => [s.ID_SEKOLAH, s]));

  const sekolah: OrgPublicProfile[] = activeSekolahList.map((s) => {
    const allowHp = Boolean(s.TAMPILKAN_HP);
    return {
      id: s.ID_SEKOLAH,
      kategori: 'SEKOLAH',
      nama: s.NAMA_SEKOLAH,
      jabatan: s.KEPALA_SEKOLAH
        ? `${s.JENJANG} · Kepala Sekolah: ${s.KEPALA_SEKOLAH}`
        : s.JENJANG,
      jenjang: s.JENJANG,
      kepalaSekolah: s.KEPALA_SEKOLAH || undefined,
      idSekolah: s.ID_SEKOLAH,
      namaSekolah: s.NAMA_SEKOLAH,
      alamat: s.ALAMAT,
      wilayahTugas: s.ALAMAT,
      mapsUrl: buildMapsUrl(s.MAPS_URL, `${s.NAMA_SEKOLAH}, ${s.ALAMAT}`),
      fotoUrl: s.FOTO_URL || undefined,
      noHp: allowHp && s.NO_HP ? s.NO_HP : undefined,
      waUrl: buildWhatsAppUrl(s.NO_HP, allowHp),
      tampilkanHp: allowHp,
      urutan: s.URUTAN,
    };
  });

  const guru: OrgPublicProfile[] = rawGuru
    .filter((g) => g.AKTIF && g.TAMPILKAN_PUBLIK && sekolahMap.has(g.ID_SEKOLAH))
    .sort((a, b) => a.URUTAN - b.URUTAN)
    .map((g) => {
      const parentSchool = sekolahMap.get(g.ID_SEKOLAH)!;
      const allowHp = Boolean(g.TAMPILKAN_HP);
      return {
        id: g.ID_GURU,
        kategori: 'GURU',
        nama: g.NAMA,
        jabatan: g.JABATAN,
        idSekolah: g.ID_SEKOLAH,
        namaSekolah: parentSchool.NAMA_SEKOLAH,
        jenjang: parentSchool.JENJANG,
        alamat: parentSchool.ALAMAT,
        wilayahTugas: parentSchool.NAMA_SEKOLAH,
        fotoUrl: g.FOTO_URL || undefined,
        noHp: allowHp && g.NO_HP ? g.NO_HP : undefined,
        waUrl: buildWhatsAppUrl(g.NO_HP, allowHp),
        tampilkanHp: allowHp,
        urutan: g.URUTAN,
      };
    });

  const balaiRw: OrgPublicProfile[] = rawBalaiRw
    .filter((b) => b.AKTIF && b.TAMPILKAN_PUBLIK && activeRwSet.has(b.ID_RW))
    .sort((a, b) => a.URUTAN - b.URUTAN)
    .map((b) => {
      const parentRw = rwMap.get(b.ID_RW);
      const allowHp = Boolean(b.TAMPILKAN_HP);
      return {
        id: b.ID_BALAI,
        kategori: 'BALAI_RW',
        nama: b.NAMA_BALAI,
        jabatan: parentRw ? `Balai Pertemuan ${parentRw.NOMOR_RW}` : 'Balai RW',
        idRw: b.ID_RW,
        nomorRw: parentRw?.NOMOR_RW || '-',
        alamat: b.ALAMAT,
        wilayahTugas: b.ALAMAT,
        jamLayanan: b.JAM_LAYANAN || undefined,
        mapsUrl: buildMapsUrl(b.MAPS_URL, `${b.NAMA_BALAI}, ${b.ALAMAT}`),
        fotoUrl: b.FOTO_URL || undefined,
        noHp: allowHp && b.NO_HP ? b.NO_HP : undefined,
        waUrl: buildWhatsAppUrl(b.NO_HP, allowHp),
        tampilkanHp: allowHp,
        urutan: b.URUTAN,
      };
    });

  return {
    kelurahan,
    lpmk,
    rw,
    rt,
    kader,
    sekolah,
    guru,
    balaiRw,
    displaySettings,
  };
}

export function computeAdminOrgSummary(db: SiwargaDatabase): AdminOrgStructureResponse['summary'] {
  return {
    totalLurah: db.ORG_KELURAHAN.filter((k) => k.TINGKAT === 'LURAH').length,
    totalKasi: db.ORG_KELURAHAN.filter((k) => k.TINGKAT === 'KASI').length,
    totalStaf: db.ORG_KELURAHAN.filter((k) => k.TINGKAT === 'STAF').length,
    totalLpmk: db.ORG_LPMK.length,
    totalRw: db.ORG_RW.length,
    totalRt: db.ORG_RT.length,
    totalKader: db.ORG_KADER.length,
    totalSekolah: (db.ORG_SEKOLAH || []).length,
    totalGuru: (db.ORG_GURU || []).length,
    totalBalaiRw: (db.ORG_BALAI_RW || []).length,
  };
}

export interface OrgSearchFilters {
  queryName: string;
  queryRole: string;
  category:
    | 'ALL'
    | 'KELURAHAN'
    | 'LPMK'
    | 'RW'
    | 'RT'
    | 'KADER'
    | 'SEKOLAH'
    | 'GURU'
    | 'BALAI_RW';
  rwId: string;
  rtId: string;
}

export function filterOrgProfiles(
  profiles: OrgPublicProfile[],
  filters: OrgSearchFilters
): OrgPublicProfile[] {
  const qName = filters.queryName.trim().toLowerCase();
  const qRole = filters.queryRole.trim().toLowerCase();

  return profiles.filter((p) => {
    if (filters.category !== 'ALL' && p.kategori !== filters.category) {
      return false;
    }
    if (filters.rwId && p.idRw !== filters.rwId) {
      return false;
    }
    if (filters.rtId && p.idRt !== filters.rtId) {
      return false;
    }
    if (qName) {
      const hayName = [p.nama, p.namaSekolah || '', p.alamat || '', p.wilayahTugas || '']
        .join(' ')
        .toLowerCase();
      if (!hayName.includes(qName)) {
        return false;
      }
    }
    if (qRole && !p.jabatan.toLowerCase().includes(qRole)) {
      return false;
    }
    return true;
  });
}
