"use client";

import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { auth, db } from "@/lib/firebase";

export type UserRole = "admin" | "safety_officer";

interface AuthContextValue {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      const tokenResult = await firebaseUser.getIdTokenResult();
      setUser(firebaseUser);
      setRole((tokenResult.claims.role as UserRole) ?? null);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // custom claims are baked into the ID token at mint time, so if an admin
  // changes this user's role in Firestore (which syncs the claim via the
  // onUserRoleWrite Cloud Function), the already-signed-in client won't see
  // it until the token is force-refreshed. Watching our own profile doc lets
  // us do that automatically instead of waiting for the ~1h natural refresh.
  // It also lets us react immediately when an admin deactivates this
  // account (users/{uid}.active === false) by signing them out on the spot.
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, "users", user.uid), async (snap) => {
      if (snap.data()?.active === false) {
        await signOut(auth);
        return;
      }

      const docRole = snap.data()?.role as UserRole | undefined;
      const currentToken = await user.getIdTokenResult();
      if (docRole && docRole !== currentToken.claims.role) {
        const refreshed = await user.getIdTokenResult(true);
        setRole((refreshed.claims.role as UserRole) ?? null);
      }
    });

    return unsubscribe;
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      loading,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      signOutUser: () => signOut(auth),
    }),
    [user, role, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
