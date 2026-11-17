import React, { useState } from 'react';
import {
  Award,
  Building,
  Building2,
  Clock,
  Eye,
  GraduationCap,
  HeartHandshake,
  Home,
  Landmark,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  School,
  Users,
  X,
} from 'lucide-react';
import { OrgPublicProfile } from '../shared/types';

export function getCategoryMeta(kategori: OrgPublicProfile['kategori']): {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  badgeBg: string;
  badgeText: string;
} {
  switch (kategori) {
    case 'KELURAHAN':
      return {
        label: 'Pemerintahan Kelurahan',
        Icon: Landmark,
        badgeBg: 'bg-[#0F2942] text-amber-300',
        badgeText: 'text-[#0F2942]',
      };
    case 'TP_PKK':
      return {
        label: 'TP PKK Kelurahan Ampel',
        Icon: Award,
        badgeBg: 'bg-rose-50 text-rose-900 border border-[#D4AF37]',
        badgeText: 'text-rose-900',
      };
    case 'LPMK':
      return {
        label: 'LPMK',
        Icon: Building2,
        badgeBg: 'bg-amber-100 text-amber-950 border border-amber-300',
        badgeText: 'text-amber-900',
      };
    case 'RW':
      return {
        label: 'Pengurus RW',
        Icon: Users,
        badgeBg: 'bg-sky-50 text-[#0F2942] border border-sky-200',
        badgeText: 'text-[#0F2942]',
      };
    case 'RT':
      return {
        label: 'Pengurus RT',
        Icon: Home,
        badgeBg: 'bg-slate-100 text-[#0F2942] border border-slate-300',
        badgeText: 'text-[#0F2942]',
      };
    case 'KADER':
      return {
        label: 'Kader Masyarakat',
        Icon: HeartHandshake,
        badgeBg: 'bg-amber-50 text-amber-950 border border-amber-300',
        badgeText: 'text-amber-900',
      };
    case 'SEKOLAH':
      return {
        label: 'Sekolah',
        Icon: School,
        badgeBg: 'bg-[#0F2942] text-amber-300 border border-[#D4AF37]',
        badgeText: 'text-[#0F2942]',
      };
    case 'GURU':
      return {
        label: 'Guru / Pengajar',
        Icon: GraduationCap,
        badgeBg: 'bg-emerald-50 text-emerald-950 border border-emerald-300',
        badgeText: 'text-emerald-900',
      };
    case 'BALAI_RW':
      return {
        label: 'Balai RW',
        Icon: Building,
        badgeBg: 'bg-amber-100 text-[#0F2942] border border-[#D4AF37]',
        badgeText: 'text-[#0F2942]',
      };
  }
}

function getInitials(name: string): string {
  const words = name
    .replace(/^(H\.|Hj\.|Drs\.|Dra\.|Ir\.|M\.)\s*/gi, '')
    .trim()
    .split(/\s+/);
  if (words.length === 0) return 'WA';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface OrgProfileCardProps {
  profile: OrgPublicProfile;
  onSelectDetail: (profile: OrgPublicProfile) => void;
  highlightGold?: boolean;
  compact?: boolean;
}

export const OrgProfileCard: React.FC<OrgProfileCardProps> = ({
  profile,
  onSelectDetail,
  highlightGold = false,
  compact = false,
}) => {
  const [imgBroken, setImgBroken] = useState(false);
  const meta = getCategoryMeta(profile.kategori);
  const CategoryIcon = meta.Icon;

  const isLocationEntity = profile.kategori === 'SEKOLAH' || profile.kategori === 'BALAI_RW';

  return (
    <article
      className={`bg-white rounded-2xl border-2 transition-all flex flex-col justify-between ${
        highlightGold
          ? 'border-[#D4AF37] shadow-sm'
          : 'border-slate-200 hover:border-[#0F2942]'
      } ${compact ? 'p-4' : 'p-5'}`}
    >
      <div>
        <div className="flex items-start gap-4">
          {profile.fotoUrl && !imgBroken ? (
            <img
              src={profile.fotoUrl}
              alt={`Foto ${profile.nama}`}
              onError={() => setImgBroken(true)}
              className={`w-16 h-16 ${isLocationEntity ? 'rounded-2xl' : 'rounded-full'} object-cover border-2 border-[#D4AF37] shrink-0 bg-slate-100`}
            />
          ) : (
            <div
              aria-hidden="true"
              className={`w-16 h-16 ${isLocationEntity ? 'rounded-2xl' : 'rounded-full'} bg-[#0F2942] text-amber-300 border-2 border-[#D4AF37] flex items-center justify-center font-display font-extrabold text-lg shrink-0`}
            >
              {isLocationEntity ? (
                <CategoryIcon className="w-7 h-7" />
              ) : (
                getInitials(profile.nama)
              )}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold ${meta.badgeBg}`}
            >
              <CategoryIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{profile.jenjang && profile.kategori === 'SEKOLAH' ? profile.jenjang : meta.label}</span>
            </span>

            <h3 className="mt-1.5 font-display text-lg font-extrabold text-[#0F2942] leading-snug">
              {profile.nama}
            </h3>
            <p className="text-sm font-semibold text-amber-900">{profile.jabatan}</p>
          </div>
        </div>

        {(profile.alamat || profile.wilayahTugas || profile.bidang) && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-start gap-2 text-sm text-slate-700">
            <MapPin className="w-4 h-4 text-[#0F2942] shrink-0 mt-0.5" aria-hidden="true" />
            <span>{profile.alamat || profile.wilayahTugas || profile.bidang}</span>
          </div>
        )}

        {profile.jamLayanan && (
          <div className="mt-2 flex items-start gap-2 text-xs font-medium text-slate-600">
            <Clock className="w-4 h-4 text-[#0F2942] shrink-0 mt-0.5" aria-hidden="true" />
            <span>{profile.jamLayanan}</span>
          </div>
        )}

        {profile.tampilkanHp && profile.noHp && (
          <div className="mt-2 flex items-center gap-2 text-sm font-mono font-semibold text-slate-800">
            <Phone className="w-4 h-4 text-[#0F2942] shrink-0" aria-hidden="true" />
            <span>{profile.noHp}</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSelectDetail(profile)}
          className="flex-1 min-w-[110px] px-3.5 py-2.5 rounded-xl bg-[#0F2942] hover:bg-[#173b5e] text-white text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{isLocationEntity ? 'Detail Lokasi' : 'Detail Profil'}</span>
        </button>

        {profile.mapsUrl && (
          <a
            href={profile.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[110px] px-3.5 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#0F2942] border border-sky-300 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Navigation className="w-4 h-4 text-sky-700 shrink-0" aria-hidden="true" />
            <span>Lihat Peta</span>
          </a>
        )}

        {profile.waUrl && (
          <a
            href={profile.waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[110px] px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-[#D4AF37] text-sm font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>WhatsApp</span>
          </a>
        )}
      </div>
    </article>
  );
};

interface OrgProfileModalProps {
  profile: OrgPublicProfile | null;
  onClose: () => void;
}

export const OrgProfileDetailModal: React.FC<OrgProfileModalProps> = ({ profile, onClose }) => {
  const [imgBroken, setImgBroken] = useState(false);

  if (!profile) return null;
  const meta = getCategoryMeta(profile.kategori);
  const CategoryIcon = meta.Icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="org-detail-title"
      className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full border-2 border-[#D4AF37] shadow-xl overflow-hidden">
        <div className="bg-[#0F2942] px-6 py-5 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <CategoryIcon className="w-5 h-5 text-amber-300" aria-hidden="true" />
            <span className="text-sm font-bold text-amber-300">{meta.label}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail profil"
            className="p-1.5 rounded-lg hover:bg-white/10 text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-4">
            {profile.fotoUrl && !imgBroken ? (
              <img
                src={profile.fotoUrl}
                alt={`Foto ${profile.nama}`}
                onError={() => setImgBroken(true)}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-[#D4AF37] shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-[#0F2942] text-amber-300 border-2 border-[#D4AF37] flex items-center justify-center font-display font-extrabold text-2xl shrink-0">
                {getInitials(profile.nama)}
              </div>
            )}
            <div>
              <h2 id="org-detail-title" className="font-display text-xl font-extrabold text-[#0F2942]">
                {profile.nama}
              </h2>
              <p className="text-base font-bold text-amber-900 mt-0.5">{profile.jabatan}</p>
            </div>
          </div>

          <dl className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-slate-50 text-sm">
            {profile.tingkat && (
              <div className="px-4 py-3 flex justify-between gap-4">
                <dt className="text-slate-600 font-medium">Tingkat Jabatan</dt>
                <dd className="font-bold text-[#0F2942]">{profile.tingkat}</dd>
              </div>
            )}
            {profile.pokja && (
              <div className="px-4 py-3 flex justify-between gap-4">
                <dt className="text-slate-600 font-medium">Unsur / Pokja</dt>
                <dd className="font-bold text-[#0F2942]">{profile.pokja}</dd>
              </div>
            )}
            {profile.jenjang && (
              <div className="px-4 py-3 flex justify-between gap-4">
                <dt className="text-slate-600 font-medium">Jenjang</dt>
                <dd className="font-bold text-[#0F2942]">{profile.jenjang}</dd>
              </div>
            )}
            {profile.namaSekolah && profile.kategori === 'GURU' && (
              <div className="px-4 py-3 flex justify-between gap-4">
                <dt className="text-slate-600 font-medium">Sekolah</dt>
                <dd className="font-bold text-[#0F2942] text-right">{profile.namaSekolah}</dd>
              </div>
            )}
            {(profile.alamat || profile.wilayahTugas || profile.bidang) && (
              <div className="px-4 py-3 flex justify-between gap-4">
                <dt className="text-slate-600 font-medium">
                  {profile.alamat ? 'Alamat / Lokasi' : 'Wilayah / Bidang'}
                </dt>
                <dd className="font-semibold text-slate-900 text-right">
                  {profile.alamat || profile.wilayahTugas || profile.bidang}
                </dd>
              </div>
            )}
            {profile.jamLayanan && (
              <div className="px-4 py-3 flex justify-between gap-4">
                <dt className="text-slate-600 font-medium">Jam Layanan</dt>
                <dd className="font-semibold text-slate-900 text-right">{profile.jamLayanan}</dd>
              </div>
            )}
            {profile.nomorRw && (
              <div className="px-4 py-3 flex justify-between gap-4">
                <dt className="text-slate-600 font-medium">Wilayah RW / RT</dt>
                <dd className="font-bold text-[#0F2942] text-right">
                  {profile.nomorRw}
                  {profile.nomorRt ? ` · ${profile.nomorRt}` : ''}
                </dd>
              </div>
            )}
            <div className="px-4 py-3 flex justify-between gap-4">
              <dt className="text-slate-600 font-medium">Kontak Publik</dt>
              <dd className="font-mono font-semibold text-slate-900 text-right">
                {profile.tampilkanHp && profile.noHp
                  ? profile.noHp
                  : 'Disembunyikan sesuai privasi pengurus'}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            {profile.mapsUrl && (
              <a
                href={profile.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#0F2942] border border-sky-300 text-sm font-bold flex items-center gap-2"
              >
                <Navigation className="w-4 h-4 text-sky-700" aria-hidden="true" />
                <span>Buka Google Maps</span>
              </a>
            )}
            {profile.waUrl && (
              <a
                href={profile.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-[#0B6E4F] hover:bg-[#08553d] text-white text-sm font-bold flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                <span>Hubungi via WhatsApp</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm font-bold hover:bg-slate-100 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
