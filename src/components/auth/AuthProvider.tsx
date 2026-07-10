"use client";

// ══════════════════════════════════════
// AuthProvider — Session Management
// Connected to Backend API
// ══════════════════════════════════════

import React, { useEffect, useState } from "react";
import { getCurrentSession, logout, type AuthSession } from "@/lib/authStore";
import { getUsers, type User } from "@/lib/userStore";
import { ChevronDown, LogOut, Shield, User as UserIcon } from "lucide-react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // No more auto-login - user must login manually
  return <>{children}</>;
}

// ── User Session Display ──

export function UserSessionSwitcher() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSession(getCurrentSession());
    
    // Load users from API
    const loadUsers = async () => {
      try {
        const data = await getUsers();
        setUsers(data);
      } catch (error) {
        console.error("Failed to load users:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadUsers();

    const handle = () => {
      setSession(getCurrentSession());
    };
    window.addEventListener("auth-changed", handle);
    return () => window.removeEventListener("auth-changed", handle);
  }, []);

  const currentUser = users.find((u) => u.id === session?.userId);

  const handleLogout = async () => {
    try {
      await logout();
      setShowDropdown(false);
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (!session || !currentUser) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] hover:bg-[var(--bg-surface-hover)] transition-colors group"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
          {currentUser.firstName?.[0]}{currentUser.lastName?.[0]}
        </div>
        <div className="text-left hidden lg:block">
          <div className="text-[12px] font-semibold text-[var(--text-primary)] leading-tight">
            {currentUser.firstName} {currentUser.lastName}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
            {currentUser.platformRole === "admin" ? (
              <><Shield size={9} className="text-red-500" /> Admin</>
            ) : (
              <><UserIcon size={9} /> User</>
            )}
          </div>
        </div>
        <ChevronDown size={12} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors" />
      </button>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          <div className="absolute right-0 bottom-full mb-1 z-50 w-72 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-inset)]">
              <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">User Profile</div>
            </div>
            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold">
                  {currentUser.firstName?.[0]}{currentUser.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {currentUser.firstName} {currentUser.lastName}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)] truncate">
                    {currentUser.email}
                  </div>
                  {currentUser.position && (
                    <div className="text-xs text-[var(--text-tertiary)] truncate">
                      {currentUser.position}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="border-t border-[var(--border-subtle)] px-4 py-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-[11px] font-semibold text-red-500 hover:text-red-600 transition-colors w-full py-1"
              >
                <LogOut size={12} /> Logout
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
