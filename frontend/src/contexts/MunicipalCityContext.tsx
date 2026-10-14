import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { sortedIndianCities } from "@/data/indianCities";

interface MunicipalCityContextType {
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  availableCities: string[];
}

const MunicipalCityContext = createContext<MunicipalCityContextType | null>(null);

const STORAGE_KEY = "civiclens_municipal_selected_city";

export const MunicipalCityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Initial city resolution: stored city -> user's city -> default to "Durgapur"
  const [selectedCity, setSelectedCityState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    if (user?.city) return user.city;
    return "Durgapur";
  });

  useEffect(() => {
    if (user?.city && !localStorage.getItem(STORAGE_KEY)) {
      setSelectedCityState(user.city);
      localStorage.setItem(STORAGE_KEY, user.city);
    }
  }, [user?.city]);

  const setSelectedCity = (city: string) => {
    setSelectedCityState(city);
    localStorage.setItem(STORAGE_KEY, city);
  };

  return (
    <MunicipalCityContext.Provider
      value={{
        selectedCity,
        setSelectedCity,
        availableCities: sortedIndianCities,
      }}
    >
      {children}
    </MunicipalCityContext.Provider>
  );
};

export function useMunicipalCity() {
  const ctx = useContext(MunicipalCityContext);
  if (!ctx) {
    throw new Error("useMunicipalCity must be used within a MunicipalCityProvider");
  }
  return ctx;
}
