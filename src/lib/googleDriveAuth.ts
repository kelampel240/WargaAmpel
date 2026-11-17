import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

export const DRIVE_SCOPES = WORKSPACE_SCOPES;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
// In-memory only: access tokens must NEVER be written to localStorage or sessionStorage.
let cachedAccessToken: string | null = null;

export function isFirebaseOAuthSupportedOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.run.app') ||
    host.endsWith('.firebaseapp.com') ||
    host.endsWith('.web.app')
  );
}

export function initGoogleDriveAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
): () => void {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
}

export async function googleSignIn(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses Google Drive dari sesi autentikasi.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err) {
    const code = (err as { code?: string })?.code || '';
    const msg = (err as Error)?.message || '';
    if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'domain ini';
      throw new Error(
        `Domain "${host}" belum didaftarkan pada Authorized Domains di Firebase Console, sehingga login OAuth browser langsung tidak diizinkan. Koneksi Google Drive & Sheets tetap berjalan otomatis melalui Google Apps Script di bawah ini.`
      );
    }
    if (code === 'auth/popup-blocked') {
      throw new Error('Popup login Google diblokir browser. Izinkan popup atau gunakan akses langsung Google Apps Script.');
    }
    if (code === 'auth/popup-closed-by-user') {
      throw new Error('Jendela login Google ditutup sebelum selesai.');
    }
    throw err;
  } finally {
    isSigningIn = false;
  }
}

export async function getGoogleDriveAccessToken(): Promise<string | null> {
  return cachedAccessToken;
}

export function clearCachedAccessToken(): void {
  cachedAccessToken = null;
}

export async function logoutGoogleDrive(): Promise<void> {
  cachedAccessToken = null;
  await auth.signOut();
}
