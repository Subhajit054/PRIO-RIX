import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase.js';
import { storeGoogleToken, GOOGLE_OAUTH_SCOPES } from './googleOAuth.js';
import { saveGoogleIntegrationInFirestore } from './firestore.js';

/**
 * Register a new user with Email and Password
 * Automatically sets up their Firestore user profile document under /users/{uid}
 */
export async function registerWithEmail(email, password, displayName = '') {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  if (displayName) {
    await updateProfile(user, { displayName });
  }

  // Initialize or update user profile document in Firestore
  try {
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, {
      uid: user.uid,
      email: user.email,
      displayName: displayName || user.displayName || 'Priorix User',
      photoURL: user.photoURL || null,
      attentionThreshold: 75,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('Could not write user profile to Firestore immediately:', err);
  }

  return user;
}

/**
 * Login with Email and Password
 */
export async function loginWithEmail(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

/**
 * Sign in using Google Provider popup and activate Gmail + Calendar Workspace sync
 */
export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const user = result.user;
  const accessToken = credential?.accessToken || null;
  const userTimezone = typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
    : 'Asia/Kolkata';

  if (accessToken && user?.uid) {
    storeGoogleToken(user.uid, accessToken, 3600);

    // Persist Google Workspace connected state in Firestore so Gmail + Calendar auto-sync immediately activates
    try {
      await saveGoogleIntegrationInFirestore(user.uid, {
        email: user.email || '',
        scopes: GOOGLE_OAUTH_SCOPES,
        calendarSyncEnabled: true,
        gmailSyncEnabled: true,
        connected: true,
        connectedAt: new Date().toISOString(),
        status: 'CONNECTED',
      });
    } catch (e) {
      console.warn('Could not save Google integration state on login:', e);
    }

    // Register token with server-side vault & background worker
    try {
      fetch('/api/auth/google/register-client-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email || '',
          accessToken,
          scopes: GOOGLE_OAUTH_SCOPES,
        }),
      }).catch(() => {});

      fetch('/api/worker/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email || '',
          accessToken,
          userTimezone,
        }),
      }).catch(() => {});
    } catch {
      // non-blocking
    }
  }

  // Ensure user profile document exists in Firestore
  try {
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || 'Priorix User',
      photoURL: user.photoURL || null,
      attentionThreshold: 75,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('Could not write user profile to Firestore immediately:', err);
  }

  return user;
}

/**
 * Updates user's display name and profile fields in Firebase Auth and Firestore
 */
export async function updateUserProfileInFirestore(uid, updates = {}) {
  if (!uid) throw new Error('User ID is required');

  if (auth.currentUser && updates.displayName) {
    try {
      await updateProfile(auth.currentUser, { displayName: updates.displayName });
    } catch (err) {
      console.warn('Could not update Firebase Auth displayName:', err);
    }
  }

  const userDocRef = doc(db, 'users', uid);
  await setDoc(
    userDocRef,
    {
      ...updates,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return updates;
}

/**
 * Sign out the currently authenticated user
 */
export async function logoutUser() {
  await signOut(auth);
}

/**
 * Subscribe to auth state changes
 */
export function subscribeToAuthChanges(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Fetch a user's Firestore profile
 */
export async function getUserProfile(uid) {
  if (!uid) return null;
  try {
    const userDocRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap && docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.warn('Could not fetch user profile from Firestore (offline or initial connection):', error?.message || error);
    return null;
  }
}
