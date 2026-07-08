"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import {useRouter} from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { AUTH_UNAUTHORIZED_EVENT } from "@/lib/api";
import { authApi } from "@/features/auth/api/authApi";
import { useTheme } from "next-themes";
import { setClientToken, removeClientTokens, getClientToken } from "@/lib/client-token";

interface User {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    is_superuser: boolean;
    groups: string[];
    permissions: string[];
    theme: 'light' | 'dark' | 'system';
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (token: string) => Promise<void>;
    logout: () => void;
    hasPermission: (permission: string) => boolean;
    updateUser: (updatedFields: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const { setTheme } = useTheme();

    // Use a ref to break the dependency chain: next-themes@0.4.x memoizes setTheme
    // with useCallback(fn, [theme]), causing its reference to change on every theme
    // transition. Without the ref, fetchUser would re-create -> effect re-runs ->
    // re-reads stale server theme -> setTheme -> infinite light/dark oscillation.
    const setThemeRef = useRef(setTheme);
    useEffect(() => { setThemeRef.current = setTheme; }, [setTheme]);

    // Single source of truth for resolving the current session from a stored token.
    // Used both on mount (session restore) and after login. Keeping one path with one
    // endpoint avoids the divergence that previously called a non-existent /core/me/.
    const fetchUser = useCallback(async () => {
        try {
            const token = getClientToken();
            if (!token) {
                setUser(null);
                setIsAuthenticated(false);
                return;
            }

            const userData = await authApi.getCurrentUser();
            setUser(userData);
            setIsAuthenticated(true);

            // Automatically synchronize theme with server-persisted preference
            if (userData.theme) {
                setThemeRef.current(userData.theme);
            }
        } catch (error) {
            console.error("Auth init error:", error);
            setUser(null);
            setIsAuthenticated(false);
            // Only discard credentials when the server explicitly rejects them.
            // A transient network failure or 5xx must not log the user out.
            const status = axios.isAxiosError(error) ? error.response?.status : undefined;
            if (status === 401 || status === 403) {
                removeClientTokens();
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // Session restore on mount: legitimately syncs React state from
        // localStorage + the server (the canonical use case for an effect).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchUser();
    }, [fetchUser]);

    // Listen for forced logout from outside React (e.g., token refresh failure
    // in the Axios interceptor). When the interceptor determines the session
    // is unrecoverable it dispatches a window event to bridge the gap between
    // its non-React scope and our React state.
    useEffect(() => {
        const handleUnauthorized = () => {
            toast.error("Tu sesión ha expirado. Inicia sesión nuevamente.");
            setUser(null);
            setIsAuthenticated(false);
            router.push("/login");
        };
        window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
        return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    }, [router]);

    const login = async (token: string) => {
        setClientToken(token);
        setIsLoading(true);
        await fetchUser();
    };

    const logout = () => {
        // Clear backend HttpOnly cookie
        authApi.logout().catch(() => {
            // Best-effort: cookie also expires after max-age
        });
        removeClientTokens();
        setUser(null);
        setIsAuthenticated(false);
        router.push("/login");
    };

    const hasPermission = (permission: string): boolean => {
        if (!user) return false;
        if (user.is_superuser || user.groups?.includes('ADMIN')) return true;

        return user.permissions?.includes(permission) || false;
    };

    const updateUser = (updatedFields: Partial<User>) => {
        setUser(prev => prev ? { ...prev, ...updatedFields } : null);
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout, hasPermission, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
