// google-config.js — the ONLY file you need to touch to enable Google sign-in.
//
// Sign-in powers "Send to Google Docs". It is optional: with the placeholders
// below left as-is, the app runs exactly as before and the Connect button
// explains that setup is needed.
//
// Follow the "Connect to Google" section of the README to create these two
// OAuth client IDs in Google Cloud Console (free, ~10 minutes), then paste
// them here:
//
//  ANDROID_CLIENT_ID — an "Android" OAuth client bound to this app's package
//    name (church.osbornevillage.pastepretty) and signing-cert SHA-1 (printed
//    in the README). Used by the installed APK.
//
//  WEB_CLIENT_ID — a "Web application" OAuth client whose authorized
//    JavaScript origin is wherever you host the web app. Used by the
//    browser/PWA version.

export const ANDROID_CLIENT_ID = 'PASTE_YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';
export const WEB_CLIENT_ID = 'PASTE_YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';

// What we ask for. drive.file only reaches files the user explicitly picks or
// the app creates — Paste Pretty never sees the rest of their Drive.
export const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
].join(' ');

// The Custom Tab returns to the APK through this scheme (declared in
// AndroidManifest.xml). Google requires it to equal the package name.
export const ANDROID_REDIRECT_URI = 'church.osbornevillage.pastepretty:/oauth2redirect';

const isPlaceholder = (id) => !id || id.startsWith('PASTE_YOUR_');

export function androidConfigured() {
  return !isPlaceholder(ANDROID_CLIENT_ID);
}
export function webConfigured() {
  return !isPlaceholder(WEB_CLIENT_ID);
}
