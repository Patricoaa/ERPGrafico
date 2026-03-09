"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/api";

interface User {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    is_superuser: boolean;
    groups: string[];
    permissions: string[];
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (token: string) => Promise<void>;
    logout: () => void;
    hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const fetchUser = async () => {
        const token = localStorage.getItem("access_token");
        if (!token) {
            setIsLoading(false);
            return;
        }

        try {
            const res = await api.get('/core/auth/me/');

            if (res.status === 200) {
                const userData = res.data;
                console.log("=== AuthContext Loaded User ===", userData);
                console.log("=== User Permissions ===", userData.permissions);
                setUser(userData);
                setIsAuthenticated(true);
            } else {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                setIsAuthenticated(false);
            }
        } catch (error) {
            console.error("Auth init error:", error);
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        fetchUser();
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

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout, hasPermission }}>
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
