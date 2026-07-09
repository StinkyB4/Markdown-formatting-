// google-auth.js — Google sign-in, the foundation for "Send to Google Docs".
//
// Two very different paths, one tiny API:
//
//  APK (Capacitor/Android): Google BLOCKS OAuth inside WebViews, so the flow
//    must go through a real browser tab. We use the standard installed-app
//    recipe: open a Custom Tab (Browser plugin) at Google's auth endpoint with
//    a PKCE challenge, get bounced back into the app via our custom scheme
//    (App plugin's appUrlOpen), then exchange the code for tokens. Android
//    OAuth clients have no client secret — PKCE is the proof. We get a refresh
//    token, so sign-in is once, ever.
//
//  Web/PWA: Google Identity Services token client. No refresh token in the
//    browser; when the hour-long access token expires we re-request, which is
//    silent while the user's Google session is alive.
//
// Tokens are stored in localStorage — device-local, same trust level as the
// clipboard content itself. Nothing ever touches a server of ours; the app
// talks only to Google.

import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import {
  ANDROID_CLIENT_ID,
  WEB_CLIENT_ID,
  SCOPES,
  ANDROID_REDIRECT_URI,
  androidConfigured,
  webConfigured,
} from './google-config.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

const STORE_KEY = 'pp-google';
const PKCE_KEY = 'pp-google-pkce';

const isNative = () => {
  const cap = typeof window !== 'undefined' ? window.Capacitor : undefined;
  return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
};

// ---- Persisted state ------------------------------------------------------

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || null;
  } catch {
    return null;
  }
}
function saveState(state) {
  try {
    if (state) localStorage.setItem(STORE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode — sign-in lasts the session only */
  }
}

let state = loadState(); // { accessToken, expiresAt, refreshToken?, email? }
let onChange = () => {};
const notify = () => onChange(getAccount());

// ---- Public API -----------------------------------------------------------

export function isConfigured() {
  return isNative() ? androidConfigured() : webConfigured();
}

export function isSignedIn() {
  return !!(state && (state.refreshToken || state.expiresAt > Date.now()));
}

export function getAccount() {
  return isSignedIn() ? { email: state.email || null } : null;
}

// Wire up the redirect listener (native) and the change callback. Call once.
export function initGoogleAuth(onChangeCallback) {
  if (onChangeCallback) onChange = onChangeCallback;
  if (isNative()) {
    App.addListener('appUrlOpen', ({ url }) => {
      if (url && url.startsWith(ANDROID_REDIRECT_URI)) handleRedirect(url);
    });
  }
  notify();
}

export async function signIn() {
  if (!isConfigured()) {
    throw new Error(
      'Google sign-in is not set up in this build yet. See the "Connect to Google" section of the README.'
    );
  }
  if (isNative()) return signInNative();
  return signInWeb();
}

export async function signOut() {
  const token = state && (state.refreshToken || state.accessToken);
  state = null;
  saveState(null);
  notify();
  if (token) {
    // Best effort — local sign-out already succeeded either way.
    try {
      await fetch(REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'token=' + encodeURIComponent(token),
      });
    } catch {
      /* offline — token simply expires on its own */
    }
  }
}

// A valid access token, refreshing/re-requesting when needed.
// Throws if not signed in or the grant has been revoked.
export async function getAccessToken() {
  if (!state) throw new Error('Not signed in.');
  if (state.expiresAt > Date.now() + 60_000) return state.accessToken;
  if (state.refreshToken) return refreshNative();
  if (!isNative()) return signInWeb(); // silent while the Google session lives
  throw new Error('Your Google sign-in expired. Please connect again.');
}

// ---- Native (APK) path: PKCE + Custom Tab ---------------------------------

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function makePkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

let pendingSignIn = null; // { resolve, reject } for the in-flight redirect

async function signInNative() {
  const { verifier, challenge } = await makePkce();
  // Survives the app being backgrounded (or restarted) behind the Custom Tab.
  try {
    localStorage.setItem(PKCE_KEY, verifier);
  } catch {
    /* fall back to the in-memory copy below */
  }

  const params = new URLSearchParams({
    client_id: ANDROID_CLIENT_ID,
    redirect_uri: ANDROID_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline', // refresh token → sign in once, ever
    prompt: 'consent',
  });

  const done = new Promise((resolve, reject) => {
    pendingSignIn = { resolve, reject, verifier };
  });
  await Browser.open({ url: `${AUTH_URL}?${params}` });
  return done;
}

async function handleRedirect(url) {
  try {
    Browser.close().catch(() => {});
    // The scheme URI ("pkg:/path?query") parses fine with the URL class.
    const query = new URL(url).searchParams;
    const err = query.get('error');
    if (err) throw new Error(err === 'access_denied' ? 'Sign-in was cancelled.' : err);
    const code = query.get('code');
    if (!code) throw new Error('Google did not return a sign-in code.');

    let verifier = pendingSignIn && pendingSignIn.verifier;
    try {
      verifier = localStorage.getItem(PKCE_KEY) || verifier;
      localStorage.removeItem(PKCE_KEY);
    } catch {
      /* use the in-memory verifier */
    }
    if (!verifier) throw new Error('Sign-in state was lost. Please try again.');

    const tokens = await tokenRequest({
      client_id: ANDROID_CLIENT_ID,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: ANDROID_REDIRECT_URI,
    });

    state = {
      accessToken: tokens.access_token,
      expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
      refreshToken: tokens.refresh_token || null,
      email: null,
    };
    state.email = await fetchEmail(state.accessToken);
    saveState(state);
    notify();
    if (pendingSignIn) pendingSignIn.resolve(getAccount());
  } catch (err) {
    if (pendingSignIn) pendingSignIn.reject(err);
  } finally {
    pendingSignIn = null;
  }
}

async function refreshNative() {
  const tokens = await tokenRequest({
    client_id: ANDROID_CLIENT_ID,
    refresh_token: state.refreshToken,
    grant_type: 'refresh_token',
  });
  state.accessToken = tokens.access_token;
  state.expiresAt = Date.now() + (tokens.expires_in || 3600) * 1000;
  saveState(state);
  return state.accessToken;
}

async function tokenRequest(fields) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A revoked grant means the stored refresh token is dead — start over.
    if (data.error === 'invalid_grant') {
      state = null;
      saveState(null);
      notify();
      throw new Error('Your Google sign-in was revoked. Please connect again.');
    }
    throw new Error(data.error_description || data.error || 'Google sign-in failed.');
  }
  return data;
}

// ---- Web/PWA path: Google Identity Services token client ------------------

let gisReady = null;
function loadGis() {
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not reach Google sign-in. Are you online?'));
    document.head.appendChild(s);
  });
  return gisReady;
}

async function signInWeb() {
  await loadGis();
  const hadSession = !!state; // silent re-issue only works with a live session
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: WEB_CLIENT_ID,
      scope: SCOPES,
      callback: async (resp) => {
        if (resp.error) {
          reject(new Error(resp.error === 'access_denied' ? 'Sign-in was cancelled.' : resp.error));
          return;
        }
        state = {
          accessToken: resp.access_token,
          expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000,
          refreshToken: null,
          email: (state && state.email) || null,
        };
        if (!state.email) state.email = await fetchEmail(state.accessToken);
        saveState(state);
        notify();
        resolve(isSignedIn() ? state.accessToken : getAccount());
      },
      error_callback: (err) => reject(new Error(err.message || 'Sign-in was cancelled.')),
    });
    client.requestAccessToken({ prompt: hadSession ? '' : 'consent' });
  });
}

// ---- Shared ----------------------------------------------------------------

async function fetchEmail(accessToken) {
  try {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
    if (!res.ok) return null;
    return (await res.json()).email || null;
  } catch {
    return null;
  }
}
