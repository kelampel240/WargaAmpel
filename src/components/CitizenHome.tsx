import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  HandHeart,
  HelpCircle,
  Megaphone,
  PlayCircle,
  SearchCheck,
  Users,
  X,
} from 'lucide-react';
import {
  ProgramStatus,
  PublicBerandaResponse,
  ServiceGroup,
  ServiceWithForm,
  SheetGaleri,
  SheetPengumuman,
  SheetProgram,
} from '../shared/types';
import { formatTanggalIndo } from '../lib/api';

import heroFallbackImg from '../assets/images/hero_desa_ampel_1795122998295.jpg';
import kerjaBaktiFallbackImg from '../assets/images/program_kerja_bakti_1795123000265.jpg';
import posyanduFallbackImg from '../assets/images/program_posyandu_sehat_1795123000134.jpg';
import umkmFallbackImg from '../assets/images/program_umkm_desa_1795122999705.jpg';

const BUNDLED_IMAGE_MAP: Record<string, string> = {
  '/src/assets/images/hero_desa_ampel_1795122998295.jpg': heroFallbackImg,
  '/src/assets/images/program_kerja_bakti_1795123000265.jpg': kerjaBaktiFallbackImg,
  '/src/assets/images/program_posyandu_sehat_1795123000134.jpg': posyanduFallbackImg,
  '/src/assets/images/program_umkm_desa_1795122999705.jpg': umkmFallbackImg,
};

function resolveBerandaImageUrl(url?: string, defaultFallback?: string): string {
  const clean = String(url || '').trim();
  if (!clean) return defaultFallback || '';
  if (BUNDLED_IMAGE_MAP[clean]) return BUNDLED_IMAGE_MAP[clean];
  return clean;
}

export type WizardEntryMode = 'pengaduan' | 'bantuan' | 'administrasi' | 'tidak-tahu';

interface CitizenHomeProps {
  services: ServiceWithForm[];
  announcements: SheetPengumuman[];
  beranda?: PublicBerandaResponse | null;
  berandaLoading?: boolean;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  onStartWizard: (mode: WizardEntryMode, preselectedService?: ServiceWithForm) => void;
  onGoTrack: () => void;
  onGoAllAnnouncements: () => void;
  onGoAllServices?: () => void;
  onGoStruktur?: () => void;
  activeSection?: 'home' | 'services' | 'announcements';
}

const BerandaImageFrame: React.FC<{
  src: string;
  alt: string;
  fallbackTitle: string;
  className?: string;
  imgClassName?: string;
}> = ({ src, alt, fallbackTitle, className = '', imgClassName = 'w-full h-full object-cover' }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`bg-gradient-to-br from-[#0F2942] via-[#134E5E] to-[#0B6E4F] flex flex-col items-center justify-center p-6 text-center text-white ${className}`}
      >
        <Camera className="w-8 h-8 text-emerald-200 mb-2" aria-hidden="true" />
        <p className="font-display font-bold text-sm leading-snug line-clamp-2">{fallbackTitle}</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={imgClassName}
    />
  );
};

export const CitizenHome: React.FC<CitizenHomeProps> = ({
  services = [],
  announcements = [],
  beranda = null,
  berandaLoading = false,
  loading = false,
  loadError = '',
  onRetry,
  onStartWizard,
  onGoTrack,
  onGoAllAnnouncements,
  onGoAllServices,
  onGoStruktur,
  activeSection = 'home',
}) => {
  const [selectedGroup, setSelectedGroup] = useState<ServiceGroup | 'ALL'>('ALL');
  const [programFilter, setProgramFilter] = useState<ProgramStatus | 'SEMUA'>('SEMUA');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const safeServices = Array.isArray(services) ? services : [];
  const safeAnnouncements = Array.isArray(announcements) ? announcements : [];
  const groups = Array.from(new Set(safeServices.map((s) => s.KATEGORI_GRUP)));
  const filteredServices =
    selectedGroup === 'ALL'
      ? safeServices
      : safeServices.filter((s) => s.KATEGORI_GRUP === selectedGroup);

  const programs: SheetProgram[] = useMemo(() => {
    const raw = Array.isArray(beranda?.program) ? beranda.program : [];
    return raw;
  }, [beranda]);

  const filteredPrograms = useMemo(() => {
    if (programFilter === 'SEMUA') return programs;
    return programs.filter((p) => p.STATUS === programFilter);
  }, [programs, programFilter]);

  const galeriList: SheetGaleri[] = useMemo(() => {
    return Array.isArray(beranda?.galeri) ? beranda.galeri : [];
  }, [beranda]);

  const topAnnouncements = useMemo(() => {
    if (Array.isArray(beranda?.pengumuman) && beranda.pengumuman.length > 0) {
      return beranda.pengumuman.slice(0, 3);
    }
    return safeAnnouncements.slice(0, 3);
  }, [beranda, safeAnnouncements]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight' && galeriList.length > 1) {
        setLightboxIndex((prev) => (prev === null ? null : (prev + 1) % galeriList.length));
      }
      if (e.key === 'ArrowLeft' && galeriList.length > 1) {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev - 1 + galeriList.length) % galeriList.length
        );
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, galeriList.length]);

  // --------------------------------------------------------------------------
  // PRESERVED VIEW: DAFTAR LAYANAN (/services)
  // --------------------------------------------------------------------------
  if (activeSection === 'services') {
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0F2942] text-balance">
            Layanan Kelurahan Ampel
          </h1>
          <p className="mt-2 text-base sm:text-lg text-slate-700 max-w-2xl">
            Pilih layanan yang Anda butuhkan. Jika ragu memilih kategori, Anda tetap bisa menekan tombol bantuan umum.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-8">
          <button
            type="button"
            onClick={() => setSelectedGroup('ALL')}
            className={`px-4 py-2.5 text-sm font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedGroup === 'ALL'
                ? 'bg-[#0F2942] text-white border-[#0F2942]'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            Semua Layanan ({services.length})
          </button>
          {groups.map((grp) => (
            <button
              key={grp}
              type="button"
              onClick={() => setSelectedGroup(grp)}
              className={`px-4 py-2.5 text-sm font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedGroup === grp
                  ? 'bg-[#0B6E4F] text-white border-[#0B6E4F]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {grp}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServices.map((svc) => (
            <div
              key={svc.ID_LAYANAN}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4 hover:border-[#0B6E4F] transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {svc.KATEGORI_GRUP} · PJ: {svc.NAMA_PETUGAS_PJ}
                </p>
                <h2 className="mt-1.5 font-display text-xl font-bold text-slate-900">
                  {svc.NAMA_LAYANAN}
                </h2>
                <p className="mt-2 text-base text-slate-700 leading-relaxed">
                  {svc.DESKRIPSI}
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  Persyaratan: <span className="font-medium text-slate-800">{svc.PERSYARATAN_DOKUMEN || 'Opsional'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const mode: WizardEntryMode = svc.KATEGORI_GRUP.startsWith('B.')
                    ? 'bantuan'
                    : svc.KATEGORI_GRUP.startsWith('C.')
                    ? 'administrasi'
                    : 'pengaduan';
                  onStartWizard(mode, svc);
                }}
                className="w-full py-3 px-4 bg-[#0B6E4F] text-white text-base font-semibold rounded-lg hover:bg-[#08553d] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Ajukan Layanan Ini</span>
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </main>
    );
  }

  // --------------------------------------------------------------------------
  // PRESERVED VIEW: SEMUA PENGUMUMAN (/announcements)
  // --------------------------------------------------------------------------
  if (activeSection === 'announcements') {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0F2942] text-balance">
            Informasi &amp; Pengumuman Desa Ampel
          </h1>
          <p className="mt-2 text-base sm:text-lg text-slate-700">
            Kabar resmi pelayanan, jadwal bantuan sosial, dan kegiatan masyarakat dari Pemerintah Desa Ampel.
          </p>
        </div>

        <div className="space-y-5">
          {announcements.map((item) => (
            <article
              key={item.ID_PENGUMUMAN}
              className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span className="font-semibold text-[#0B6E4F]">{item.KATEGORI}</span>
                <span aria-hidden="true">·</span>
                <span>{formatTanggalIndo(item.TANGGAL_TERBIT)}</span>
                <span aria-hidden="true">·</span>
                <span>{item.PENULIS}</span>
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">
                {item.JUDUL}
              </h2>
              <p className="mt-3 text-base text-slate-700 leading-relaxed whitespace-pre-line">
                {item.ISI}
              </p>
            </article>
          ))}
        </div>
      </main>
    );
  }

  // --------------------------------------------------------------------------
  // NEW BERANDA WARGA AMPEL (7 SECTIONS)
  // --------------------------------------------------------------------------
  const heroTitle = beranda?.banner?.JUDUL || 'WARGA AMPEL';
  const heroSambutan =
    beranda?.banner?.KALIMAT_SAMBUTAN ||
    'Ikuti program kegiatan kelurahan, cek kabar terbaru desa, atau sampaikan kebutuhan layanan Anda secara mudah.';
  const heroImgSrc = resolveBerandaImageUrl(beranda?.banner?.GAMBAR_URL, heroFallbackImg);

  const isLoadingHome = (berandaLoading || loading) && !beranda;
  const activeLightboxItem = lightboxIndex !== null ? galeriList[lightboxIndex] : null;

  const scrollToProgram = () => {
    const el = document.getElementById('program-kelurahan');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-12 sm:space-y-14">
      {loadError && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm font-medium text-rose-900">{loadError}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3.5 py-1.5 bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              Coba Muat Ulang
            </button>
          )}
        </div>
      )}

      {/* 1. HERO BANNER */}
      <section aria-labelledby="hero-heading">
        {isLoadingHome ? (
          <div className="h-[340px] sm:h-[420px] rounded-2xl bg-slate-200 animate-pulse border border-slate-200" />
        ) : (
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 min-h-[340px] sm:min-h-[420px] flex items-end bg-[#0F2942]">
            <div className="absolute inset-0">
              <BerandaImageFrame
                src={heroImgSrc}
                alt="Suasana Balai Desa Ampel dan kegiatan masyarakat"
                fallbackTitle={heroTitle}
                className="w-full h-full"
                imgClassName="w-full h-full object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#0F2942]/95 via-[#0F2942]/70 to-[#0B6E4F]/30 sm:bg-gradient-to-r sm:from-[#0F2942]/92 sm:via-[#0F2942]/72 sm:to-[#0B6E4F]/25"
              />
            </div>

            <div className="relative z-10 w-full p-6 sm:p-10 lg:p-12 max-w-3xl text-white">
              <p className="text-xs sm:text-sm font-semibold text-emerald-200 tracking-wide">
                Portal Warga &amp; Informasi Kelurahan · Desa Ampel
              </p>
              <h1
                id="hero-heading"
                className="mt-2 font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white text-balance"
              >
                {heroTitle}
              </h1>
              <p className="mt-3 text-base sm:text-lg text-slate-100 leading-relaxed max-w-2xl">
                {heroSambutan}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (onGoAllServices) {
                      onGoAllServices();
                    } else {
                      const el = document.getElementById('layanan-warga');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="px-5 py-3 bg-[#0B6E4F] hover:bg-[#095c41] text-white text-sm sm:text-base font-bold rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Layanan Kelurahan</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={scrollToProgram}
                  className="px-5 py-3 bg-white/95 hover:bg-white text-[#0F2942] text-sm sm:text-base font-bold rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Lihat Program</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2. LAYANAN WARGA (4 KARTU IKON + BANTUAN UMUM) */}
      <section id="layanan-warga" aria-labelledby="layanan-warga-heading" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="layanan-warga-heading" className="font-display text-2xl sm:text-3xl font-bold text-[#0F2942] text-balance">
              Layanan Warga Desa Ampel
            </h2>
            <p className="mt-1 text-base text-slate-600">
              Sampaikan laporan, ajukan bantuan atau surat keterangan, dan pantau progresnya kapan saja.
            </p>
          </div>
          {onGoAllServices && (
            <button
              type="button"
              onClick={onGoAllServices}
              className="text-sm sm:text-base font-semibold text-[#0B6E4F] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Lihat semua layanan ({safeServices.length})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => onStartWizard('pengaduan')}
            className="text-left p-5 bg-white border border-slate-200 hover:border-[#0B6E4F] hover:bg-emerald-50/40 rounded-2xl transition-colors flex flex-col justify-between gap-4 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#0B6E4F] border border-emerald-200 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-[#0F2942]">Pengaduan</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                Laporkan jalan rusak, lampu padam, sampah, atau saluran air tersumbat.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onStartWizard('bantuan')}
            className="text-left p-5 bg-white border border-slate-200 hover:border-[#0F2942] hover:bg-sky-50/40 rounded-2xl transition-colors flex flex-col justify-between gap-4 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-[#0F2942] border border-sky-200 flex items-center justify-center">
              <HandHeart className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-[#0F2942]">Bantuan</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                Ajukan bantuan sosial pangan, pendidikan sekolah, atau pendampingan kesehatan.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onStartWizard('administrasi')}
            className="text-left p-5 bg-white border border-slate-200 hover:border-[#0B6E4F] hover:bg-emerald-50/40 rounded-2xl transition-colors flex flex-col justify-between gap-4 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#0B6E4F] border border-emerald-200 flex items-center justify-center">
              <FileText className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-[#0F2942]">Surat</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                Urus surat domisili, keterangan usaha, surat tidak mampu, atau pengantar desa.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onGoTrack}
            className="text-left p-5 bg-white border border-slate-200 hover:border-[#0F2942] hover:bg-sky-50/40 rounded-2xl transition-colors flex flex-col justify-between gap-4 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-[#0F2942] border border-sky-200 flex items-center justify-center">
              <SearchCheck className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-[#0F2942]">Lacak Status</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                Pantau perkembangan tindak lanjut dan bukti penanganan dengan nomor tiket Anda.
              </p>
            </div>
          </button>
        </div>

        {/* Preserved Bantuan Umum link */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-[#0B6E4F] shrink-0" aria-hidden="true" />
            <p className="text-sm sm:text-base text-slate-800">
              Belum yakin memilih jenis layanan yang tepat? Cukup ceritakan kebutuhan Anda dengan bahasa sehari-hari.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onStartWizard('tidak-tahu')}
            className="px-4 py-2 bg-white hover:bg-emerald-100 border border-[#0B6E4F] text-[#0B6E4F] text-sm font-bold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            Saya Tidak Tahu Harus Pilih yang Mana
          </button>
        </div>
      </section>

      {/* 3. PROGRAM KELURAHAN */}
      <section id="program-kelurahan" aria-labelledby="program-heading" className="space-y-6 scroll-mt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="program-heading" className="font-display text-2xl sm:text-3xl font-bold text-[#0F2942] text-balance">
              Program Kelurahan Ampel
            </h2>
            <p className="mt-1 text-base text-slate-600">
              Agenda kegiatan warga, pemberdayaan masyarakat, dan pembangunan desa yang terbuka untuk diikuti bersama.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Filter status program"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200"
          >
            {(['SEMUA', 'Akan Datang', 'Berjalan', 'Selesai'] as const).map((statusTab) => {
              const active = programFilter === statusTab;
              return (
                <button
                  key={statusTab}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setProgramFilter(statusTab)}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-[#0F2942] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {statusTab === 'SEMUA' ? 'Semua' : statusTab}
                </button>
              );
            })}
          </div>
        </div>

        {isLoadingHome ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-80 animate-pulse">
                <div className="h-44 bg-slate-200" />
                <div className="p-5 space-y-3">
                  <div className="h-3 w-1/3 bg-slate-200 rounded" />
                  <div className="h-5 w-3/4 bg-slate-200 rounded" />
                  <div className="h-4 w-full bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredPrograms.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="font-display font-bold text-[#0F2942] text-lg">
              Belum ada program pada kategori ini
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Program kelurahan terbaru akan muncul di sini setelah diterbitkan oleh pengelola desa.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPrograms.map((prog) => {
              const StatusIcon =
                prog.STATUS === 'Selesai'
                  ? CheckCircle2
                  : prog.STATUS === 'Berjalan'
                  ? PlayCircle
                  : Clock;
              const statusTone =
                prog.STATUS === 'Selesai'
                  ? 'text-[#0B6E4F]'
                  : prog.STATUS === 'Berjalan'
                  ? 'text-sky-800'
                  : 'text-amber-800';
              const fallbackImg =
                prog.STATUS === 'Berjalan'
                  ? kerjaBaktiFallbackImg
                  : prog.STATUS === 'Selesai'
                  ? umkmFallbackImg
                  : posyanduFallbackImg;
              return (
                <article
                  key={prog.ID_PROGRAM}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col hover:border-[#0B6E4F] transition-colors"
                >
                  <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                    <BerandaImageFrame
                      src={resolveBerandaImageUrl(prog.FOTO_URL, fallbackImg)}
                      alt={prog.JUDUL}
                      fallbackTitle={prog.JUDUL}
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                      <span className={`inline-flex items-center gap-1 ${statusTone}`}>
                        <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{prog.STATUS}</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                        <span>{formatTanggalIndo(prog.TANGGAL)}</span>
                      </span>
                    </div>
                    <h3 className="mt-2 font-display text-lg font-bold text-[#0F2942] leading-snug">
                      {prog.JUDUL}
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-700 leading-relaxed line-clamp-2">
                      {prog.RINGKASAN}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. GALERI KEGIATAN */}
      <section id="galeri-kegiatan" aria-labelledby="galeri-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="galeri-heading" className="font-display text-2xl sm:text-3xl font-bold text-[#0F2942] text-balance">
              Galeri Kegiatan Warga
            </h2>
            <p className="mt-1 text-base text-slate-600">
              Dokumentasi kebersamaan masyarakat dan kegiatan kelurahan. Ketuk foto untuk memperbesar.
            </p>
          </div>
        </div>

        {isLoadingHome ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] bg-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : galeriList.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="font-display font-bold text-[#0F2942]">Galeri kegiatan belum memiliki foto</p>
            <p className="mt-1 text-sm text-slate-600">
              Dokumentasi foto kegiatan kelurahan akan ditampilkan di sini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {galeriList.map((item, idx) => (
              <button
                key={item.ID_GALERI}
                type="button"
                onClick={() => setLightboxIndex(idx)}
                className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 text-left cursor-pointer"
              >
                <BerandaImageFrame
                  src={resolveBerandaImageUrl(item.FOTO_URL, kerjaBaktiFallbackImg)}
                  alt={item.JUDUL}
                  fallbackTitle={item.JUDUL}
                  className="w-full h-full"
                  imgClassName="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/35 to-transparent"
                />
                <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <p className="text-xs font-semibold line-clamp-1">{item.JUDUL}</p>
                  <p className="text-[11px] text-slate-200 tabular-nums">{formatTanggalIndo(item.TANGGAL)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 4. PENGUMUMAN (3 TERBARU) */}
      <section aria-labelledby="pengumuman-heading" className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Megaphone className="w-6 h-6 text-[#0B6E4F]" aria-hidden="true" />
            <h2 id="pengumuman-heading" className="font-display text-2xl font-bold text-[#0F2942]">
              Pengumuman Terbaru Desa
            </h2>
          </div>
          <button
            type="button"
            onClick={onGoAllAnnouncements}
            className="text-sm sm:text-base font-semibold text-[#0B6E4F] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Lihat semua pengumuman
          </button>
        </div>

        <div className="divide-y divide-slate-200">
          {isLoadingHome ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="py-4 space-y-2 animate-pulse">
                <div className="h-3 w-36 bg-slate-200 rounded" />
                <div className="h-5 w-2/3 bg-slate-200 rounded" />
                <div className="h-4 w-full bg-slate-100 rounded" />
              </div>
            ))
          ) : topAnnouncements.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">Belum ada pengumuman aktif saat ini.</p>
          ) : (
            topAnnouncements.slice(0, 3).map((item) => (
              <div key={item.ID_PENGUMUMAN} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600">
                  <span className="font-semibold text-[#0B6E4F]">{item.KATEGORI}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{formatTanggalIndo(item.TANGGAL_TERBIT)}</span>
                </div>
                <h3 className="mt-1 font-display text-lg font-bold text-slate-900">
                  {item.JUDUL}
                </h3>
                <p className="mt-1 text-sm sm:text-base text-slate-700 leading-relaxed">
                  {item.RINGKASAN}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Preserved Struktur Organisasi Callout */}
      {onGoStruktur && (
        <section aria-labelledby="struktur-org-callout">
          <div className="bg-[#0F2942] text-white rounded-2xl border border-slate-700 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 text-emerald-300 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <h3 id="struktur-org-callout" className="font-display text-xl font-bold">
                  Struktur Organisasi Warga Ampel
                </h3>
                <p className="mt-1 text-sm sm:text-base text-slate-200">
                  Kenali pengurus Pemerintah Kelurahan, TP PKK, LPMK, Ketua RW/RT, dan Kader di lingkungan Anda.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onGoStruktur}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0F2942] text-sm font-extrabold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Lihat Struktur Organisasi
            </button>
          </div>
        </section>
      )}

      {/* 6. STATISTIK RINGKAS */}
      <section aria-labelledby="statistik-heading">
        <div className="bg-gradient-to-r from-[#0F2942] to-[#0B6E4F] text-white rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h2 id="statistik-heading" className="font-display text-xl sm:text-2xl font-bold">
                Ringkasan Kinerja &amp; Kegiatan Desa
              </h2>
              <p className="mt-1 text-sm text-emerald-100">
                Dihitung langsung dari catatan program kelurahan dan laporan warga di database desa.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-8">
              <div>
                <p className="text-xs font-medium text-emerald-200">Program Berjalan</p>
                <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">
                  {isLoadingHome ? '–' : beranda?.stats?.programBerjalan ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-emerald-200">Pengaduan Selesai Bulan Ini</p>
                <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">
                  {isLoadingHome ? '–' : beranda?.stats?.pengaduanSelesaiBulanIni ?? 0}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs font-medium text-emerald-200">Total Program Terdaftar</p>
                <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">
                  {isLoadingHome ? '–' : beranda?.stats?.totalProgram ?? 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LIGHTBOX MODAL GALERI */}
      {activeLightboxItem && lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto kegiatan: ${activeLightboxItem.JUDUL}`}
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <div>
                <h3 className="font-display font-bold text-base sm:text-lg text-[#0F2942]">
                  {activeLightboxItem.JUDUL}
                </h3>
                <p className="text-xs text-slate-500 tabular-nums">
                  {formatTanggalIndo(activeLightboxItem.TANGGAL)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                aria-label="Tutup perbesaran foto"
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="relative bg-slate-950 flex items-center justify-center max-h-[70vh] overflow-hidden">
              <BerandaImageFrame
                src={resolveBerandaImageUrl(activeLightboxItem.FOTO_URL, kerjaBaktiFallbackImg)}
                alt={activeLightboxItem.JUDUL}
                fallbackTitle={activeLightboxItem.JUDUL}
                className="w-full h-[55vh]"
                imgClassName="max-h-[70vh] w-auto object-contain"
              />
              {galeriList.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Foto sebelumnya"
                    onClick={() =>
                      setLightboxIndex((lightboxIndex - 1 + galeriList.length) % galeriList.length)
                    }
                    className="absolute left-3 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Foto berikutnya"
                    onClick={() => setLightboxIndex((lightboxIndex + 1) % galeriList.length)}
                    className="absolute right-3 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>

            {activeLightboxItem.KETERANGAN && (
              <div className="px-5 py-4 text-sm text-slate-700 bg-slate-50">
                {activeLightboxItem.KETERANGAN}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
};
