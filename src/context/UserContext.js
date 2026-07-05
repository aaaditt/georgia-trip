"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { USERS } from "@/lib/data";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("georgia-trip-user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const user = USERS.find((u) => u.id === parsed.id);
        if (user) setCurrentUser(user);
      } catch {}
    }
    setIsLoaded(true);
  }, []);

  const login = (user) => {
    setCurrentUser(user);
    localStorage.setItem("georgia-trip-user", JSON.stringify(user));
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("georgia-trip-user");
  };

  return (
    <UserContext.Provider value={{ currentUser, login, logout, isLoaded }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
