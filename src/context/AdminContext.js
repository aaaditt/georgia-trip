"use client";

import { createContext, useContext, useState, useEffect } from "react";

const AdminContext = createContext(null);

const SESSION_KEY = "georgia-trip-admin";

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "true") {
      setIsAdmin(true);
    }
  }, []);

  const unlock = (passcode) => {
    const expected = process.env.NEXT_PUBLIC_ADMIN_PASSCODE;
    if (!expected || passcode !== expected) {
      return { error: expected ? "Wrong passcode." : "Admin passcode not configured." };
    }
    setIsAdmin(true);
    sessionStorage.setItem(SESSION_KEY, "true");
    return { error: null };
  };

  const lock = () => {
    setIsAdmin(false);
    sessionStorage.removeItem(SESSION_KEY);
  };

  return (
    <AdminContext.Provider value={{ isAdmin, unlock, lock }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}
