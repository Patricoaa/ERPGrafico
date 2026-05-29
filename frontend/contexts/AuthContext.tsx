"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {useRouter} from "next/navigation";
import api from "@/lib/api";
import { useTheme } from "next-themes";

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

    const fetchUser = async () => {
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem("access_token") : null;
            if (!token) {
                setIsLoading(false);
                return;
            }

            const res = await api.get('/core/auth/me/');

            if (res.status === 200) {
                const userData = res.data;
                setUser(userData);
                setIsAuthenticated(true);
                
                // Automatically synchronize theme with server-persisted preference
                if (userData.theme) {
                    setTheme(userData.theme);
                }
            } else {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                setIsAuthenticated(false);
            }
        } catch (error) {
            console.error("Auth init error:", error);
            setIsAuthenticated(false);
            // On storage error or other failure, clear tokens
            if (typeof window !== 'undefined') {
                try {
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("refresh_token");
                } catch {}
            }
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const token = localStorage.getItem("access_token");
            if (!token) {
                if (!cancelled) setIsLoading(false);
                return;
            }
            try {
                const response = await api.get("/core/me/");
                if (!cancelled) {
                    setUser(response.data);
                    setIsAuthenticated(true);
                }
            } catch {
                try {
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("refresh_token");
                } catch {}
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })()
        return () => { cancelled = true }
    }, []);

    const login = async (token: string) => {
        localStorage.setItem("access_token", token);
        setIsLoading(true);
        await fetchUser();
    };

    const logout = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
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
