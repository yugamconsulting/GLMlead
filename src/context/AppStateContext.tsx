import { createContext, useContext } from "react";
import type { Lead, Invoice } from "../types/index";

export type AppStateUser = {
  id: string;
  name: string;
  role: string;
} | null;

export type AppStateTenant = {
  id: string;
  name: string;
} | null;

export type AppStateContextValue = {
  currentUser: AppStateUser;
  currentTenant: AppStateTenant;
  leads: Lead[];
  invoices: Invoice[];
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({
  value,
  children,
}: {
  value: AppStateContextValue;
  children: React.ReactNode;
}) {
  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return ctx;
}
