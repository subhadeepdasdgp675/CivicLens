import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface GuestReportContextType {
  guestEmail: string | null;
  setGuestEmail: (email: string) => void;
  clearGuestEmail: () => void;
}

const GuestReportContext = createContext<GuestReportContextType | null>(null);

export function GuestReportProvider({ children }: { children: ReactNode }) {
  const [guestEmail, setGuestEmailState] = useState<string | null>(null);

  const setGuestEmail = useCallback((email: string) => {
    setGuestEmailState(email);
  }, []);

  const clearGuestEmail = useCallback(() => {
    setGuestEmailState(null);
  }, []);

  return (
    <GuestReportContext.Provider value={{ guestEmail, setGuestEmail, clearGuestEmail }}>
      {children}
    </GuestReportContext.Provider>
  );
}

export function useGuestReport() {
  const ctx = useContext(GuestReportContext);
  if (!ctx) throw new Error("useGuestReport must be used within GuestReportProvider");
  return ctx;
}
