// google-config.js — the ONLY file you need to touch to enable Google sign-in.
//
// Sign-in powers "Send to Google Docs". It is optional: with the placeholders
// below left as-is, the app runs exactly as before and the Connect button
// explains that setup is needed.
//
// Follow the "Connect to Google" section of the README to create the two
// OAuth client IDs and the Picker API key in Google Cloud Console (free,
// ~10 minutes, done ONCE by the app owner — after that every user can sign
// in with their own Google account), then paste them here:
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

// What we ask for — deliberately ONLY non-sensitive scopes, so ANYONE can
// sign in once the OAuth consent screen is published: no Google verification
// process, no test-user list, no user cap, no "unverified app" warning.
//
// drive.file is the key: it only reaches files the user explicitly picks (via
// the Google file picker) or that the app creates — never the rest of their
// Drive — and the Google Docs API accepts it for reading/writing those same
// picked docs. The broader "documents" scope would work too, but it is
// classified sensitive and would lock sign-in to ~100 hand-added test users
// unless the app went through Google's verification review. Don't add it.
export const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

// Browser API key for the Google Picker (the "choose a doc" dialog used by
// Send to Google Docs). Created alongside the client IDs — see the README.
export const PICKER_API_KEY = 'PASTE_YOUR_PICKER_API_KEY';

export function pickerConfigured() {
  return !!PICKER_API_KEY && !PICKER_API_KEY.startsWith('PASTE_YOUR_');
}

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
