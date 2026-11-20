import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  subscribeToAuthChanges,
  loginWithEmail,
  registerWithEmail,
  loginWithGoogle,
  logoutUser,
  getUserProfile,
  updateUserProfileInFirestore
} from '../lib/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    
    // Hard safety bounded timeout: ensure loading state never hangs past 3.5 seconds under any network condition
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn('Firebase Auth state verification exceeded bounded timeout; releasing loading lock.');
        setLoading(false);
      }
    }, 3500);

    const unsubscribe = subscribeToAuthChanges(async (user) => {
      if (!isMounted) return;
      setCurrentUser(user);

      if (user) {
        try {
          // Bounded fetch for Firestore user profile (1.5s max timeout to prevent blocking)
          const profilePromise = getUserProfile(user.uid);
          const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1500));
          const profile = await Promise.race([profilePromise, timeoutPromise]);
          
          if (isMounted) {
            setUserProfile(profile || {
              uid: user.uid,
              displayName: user.displayName || user.email?.split('@')[0] || 'Priorix User',
              email: user.email,
              photoURL: user.photoURL || null
            });
          }
        } catch (err) {
          console.warn('Notice fetching user profile (using default):', err?.message || err);
          if (isMounted) {
            setUserProfile({
              uid: user.uid,
              displayName: user.displayName || user.email?.split('@')[0] || 'Priorix User',
              email: user.email,
              photoURL: user.photoURL || null
            });
          }
        }
      } else {
        if (isMounted) {
          setUserProfile(null);
        }
      }

      clearTimeout(safetyTimeout);
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    setAuthError(null);
    try {
      const user = await loginWithEmail(email, password);
      return user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const register = async (email, password, displayName) => {
    setAuthError(null);
    try {
      const user = await registerWithEmail(email, password, displayName);
      return user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const loginGoogle = async () => {
    setAuthError(null);
    try {
      const user = await loginWithGoogle();
      return user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    setAuthError(null);
    try {
      await logoutUser();
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const updateProfileData = async (updates) => {
    if (!currentUser?.uid) throw new Error('Not authenticated');
    await updateUserProfileInFirestore(currentUser.uid, updates);
    setUserProfile((prev) => ({
      ...(prev || {
        uid: currentUser.uid,
        email: currentUser.email,
        photoURL: currentUser.photoURL || null,
      }),
      ...updates,
    }));
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        authError,
        setAuthError,
        login,
        register,
        loginGoogle,
        logout,
        updateProfileData,
        isAuthenticated: Boolean(currentUser)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
