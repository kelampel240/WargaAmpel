import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import {
  PublicBerandaResponse,
  PublicUserSession,
  ServiceWithForm,
  SheetContohFile,
  SheetPengumuman,
} from './shared/types';
import { apiFetch, clearAuth, getStoredToken, getStoredUser, persistAuth } from './lib/api';
import { Navbar, PublicRoute } from './components/Navbar';
import { CitizenHome, WizardEntryMode } from './components/CitizenHome';
import { ReportWizard } from './components/ReportWizard';
import { TrackReportView } from './components/TrackReportView';
import { AuthModal } from './components/AuthModal';
import { CitizenDashboard } from './components/CitizenDashboard';
import { AdminDashboard, SidebarModule } from './components/AdminDashboard';
import { OrgPublicPortal } from './components/OrgPublicPortal';

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Terjadi kesalahan tampilan.' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('WARGA AMPEL render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h1 className="font-display text-xl font-bold text-[#0F2942]">
              Gagal Memuat Halaman
            </h1>
            <p className="text-sm text-slate-700">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#0B6E4F] text-white text-sm font-bold rounded-lg cursor-pointer"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [route, setRoute] = useState<PublicRoute>('home');
  const [wizardState, setWizardState] = useState<{
    open: boolean;
    mode: WizardEntryMode;
    preselected?: ServiceWithForm;
  }>({ open: false, mode: 'pengaduan' });

  const [trackPrefill, setTrackPrefill] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState<SidebarModule>('dashboard');
  const [servicesResetNonce, setServicesResetNonce] = useState(0);

  const [user, setUser] = useState<PublicUserSession | null>(() => getStoredUser());
  const [services, setServices] = useState<ServiceWithForm[]>([]);
  const [announcements, setAnnouncements] = useState<SheetPengumuman[]>([]);
  const [templateFiles, setTemplateFiles] = useState<SheetContohFile[]>([]);
  const [beranda, setBeranda] = useState<PublicBerandaResponse | null>(null);
  const [berandaLoading, setBerandaLoading] = useState(true);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState('');

  const loadPublicData = async () => {
    setPublicLoading(true);
    setBerandaLoading(true);
    setPublicError('');
    try {
      const [svcRes, annRes, berandaRes, filesRes] = await Promise.all([
        apiFetch<{ services: ServiceWithForm[] }>('/api/public/services'),
        apiFetch<{ announcements: SheetPengumuman[] }>('/api/public/announcements'),
        apiFetch<PublicBerandaResponse>('/api/public/beranda').catch(() => null),
        apiFetch<{ files: SheetContohFile[] }>('/api/public/template-files').catch(() => ({ files: [] })),
      ]);
      setServices(Array.isArray(svcRes?.services) ? svcRes.services : []);
      setAnnouncements(Array.isArray(annRes?.announcements) ? annRes.announcements : []);
      setTemplateFiles(Array.isArray(filesRes?.files) ? filesRes.files : []);
      if (berandaRes) setBeranda(berandaRes);
    } catch (err) {
      const msg = (err as Error).message || 'Gagal memuat data layanan dan pengumuman.';
      console.error('Gagal memuat data publik WARGA AMPEL:', err);
      setPublicError(msg);
    } finally {
      setPublicLoading(false);
      setBerandaLoading(false);
    }
  };

  useEffect(() => {
    loadPublicData();
    const token = getStoredToken();
    if (token) {
      apiFetch<{ user: PublicUserSession }>('/api/auth/me')
        .then((res) => {
          if (res?.user) {
            setUser(res.user);
            persistAuth(token, res.user);
          }
        })
        .catch(() => {
          clearAuth();
          setUser(null);
        });
    }
  }, []);

  const handleNavigate = (nextRoute: PublicRoute) => {
    setWizardState((w) => ({ ...w, open: false }));
    if (nextRoute === 'admin' && (!user || user.role === 'WARGA')) {
      setShowAuthModal(true);
      return;
    }
    if (nextRoute === 'admin') {
      setAdminInitialTab('dashboard');
    }
    if (nextRoute === 'services') {
      setServicesResetNonce((n) => n + 1);
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartWizard = (mode: WizardEntryMode, preselected?: ServiceWithForm) => {
    setWizardState({ open: true, mode, preselected });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = (authedUser: PublicUserSession) => {
    setUser(authedUser);
    setShowAuthModal(false);
    setWizardState((w) => ({ ...w, open: false }));
    if (authedUser.role === 'WARGA') {
      setRoute('citizen-dashboard');
    } else {
      setRoute('admin');
    }
  };

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    setRoute('home');
  };

  return (
    <AppErrorBoundary>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <Navbar
          activeRoute={route}
          onNavigate={handleNavigate}
          user={user}
          onOpenAuth={() => setShowAuthModal(true)}
          onLogout={handleLogout}
        />

        <div className="flex-1">
          {wizardState.open ? (
            <ReportWizard
              mode={wizardState.mode}
              services={services}
              preselectedService={wizardState.preselected}
              user={user}
              onCancel={() => setWizardState((w) => ({ ...w, open: false }))}
              onTrackTicket={(ticketId) => {
                setWizardState((w) => ({ ...w, open: false }));
                setTrackPrefill(ticketId);
                setRoute('track');
              }}
            />
          ) : route === 'track' ? (
            <TrackReportView key={trackPrefill} initialTicketId={trackPrefill} />
          ) : route === 'struktur' ? (
            <OrgPublicPortal />
          ) : route === 'citizen-dashboard' && user ? (
            <CitizenDashboard
              user={user}
              templateFiles={templateFiles}
              onNewReport={() => handleStartWizard('pengaduan')}
              onGoServices={() => handleNavigate('services')}
            />
          ) : route === 'admin' && user && user.role !== 'WARGA' ? (
            <AdminDashboard
              user={user}
              initialTab={adminInitialTab}
              onServicesChanged={loadPublicData}
            />
          ) : (
            <CitizenHome
              services={services}
              announcements={announcements}
              templateFiles={templateFiles}
              beranda={beranda}
              berandaLoading={berandaLoading}
              loading={publicLoading}
              loadError={publicError}
              onRetry={loadPublicData}
              activeSection={
                route === 'services'
                  ? 'services'
                  : route === 'announcements'
                  ? 'announcements'
                  : 'home'
              }
              onStartWizard={handleStartWizard}
              onGoTrack={() => handleNavigate('track')}
              onGoAllAnnouncements={() => handleNavigate('announcements')}
              onGoAllServices={() => handleNavigate('services')}
              onGoStruktur={() => handleNavigate('struktur')}
              servicesResetNonce={servicesResetNonce}
            />
          )}
        </div>

        {/* 7. FOOTER KONTAK KANTOR KELURAHAN & JAM LAYANAN */}
        <footer className="no-print bg-white border-t border-slate-200 py-8 mt-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-12 gap-6 text-sm text-slate-600">
            <div className="md:col-span-5 space-y-1.5">
              <p className="font-display font-bold text-base text-[#0F2942]">
                {beranda?.footer?.namaKantor || 'Balai Kelurahan Ampel'}
              </p>
              <p className="text-slate-600 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#0B6E4F] shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {beranda?.footer?.alamat || 'Jl. Raya Kelurahan Ampel No. 01, Kecamatan Wuluhan, Kabupaten Jember'}
                </span>
              </p>
            </div>
            <div className="md:col-span-4 space-y-1.5">
              <p className="font-semibold text-[#0F2942] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0B6E4F] shrink-0" aria-hidden="true" />
                <span>Jam Layanan Kantor</span>
              </p>
              <p className="text-slate-700">
                {beranda?.footer?.jamLayanan || 'Senin–Jumat, 08.00–14.30 WIB (Portal online aktif 24 jam)'}
              </p>
            </div>
            <div className="md:col-span-3 space-y-1.5">
              <p className="font-semibold text-[#0F2942]">Kontak Pelayanan</p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#0B6E4F] shrink-0" aria-hidden="true" />
                <span>{beranda?.footer?.telepon || '(0336) 621-104 / 0811-0000-0003'}</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#0B6E4F] shrink-0" aria-hidden="true" />
                <span>{beranda?.footer?.email || 'pelayanan@ampel.kelurahan.id'}</span>
              </p>
            </div>
          </div>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <p>WARGA AMPEL — Sistem Informasi Pelayanan &amp; Kegiatan Warga Kelurahan Ampel</p>
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={() => handleNavigate('services')} className="hover:text-[#0B6E4F] cursor-pointer">
                Layanan
              </button>
              <button type="button" onClick={() => handleNavigate('track')} className="hover:text-[#0B6E4F] cursor-pointer">
                Cek Laporan
              </button>
              <button type="button" onClick={() => handleNavigate('struktur')} className="hover:text-[#0B6E4F] cursor-pointer">
                Struktur Organisasi
              </button>
            </div>
          </div>
        </footer>

        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onSuccess={handleAuthSuccess}
          />
        )}
      </div>
    </AppErrorBoundary>
  );
}
