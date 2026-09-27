import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { defaultBusiness } from "./config";
import type { BookingRequest, BusinessConfig } from "./types";

const CONFIG_KEY = "nook.business.v3";
const REQUESTS_KEY = "nook.requests.v1";

const seedRequests = (): BookingRequest[] => {
  const soon = new Date();
  soon.setDate(soon.getDate() + 9);
  const key = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}`;
  return [
    {
      id: "req-seed-1",
      createdAt: new Date().toISOString(),
      customerName: "Nadia Berg",
      contact: "nadia.berg@mail.com",
      notes: "Covering an old anchor on the forearm, would love something botanical over it.",
      serviceId: "tattoo",
      answers: {},
      date: key,
      time: "13:00",
      memberId: "ines",
      status: "pending",
      quote: {
        low: 940,
        high: 1180,
        duration: 330,
        deposit: 210,
        requiresReview: true,
        reviewReasons: [
          "Yes — is this covering or reworking existing ink?",
          "Above the auto-approval price ceiling",
        ],
        lines: [
          { label: "Custom tattoo base", detail: "€180 · 1 hr 30 min" },
          { label: "24cm piece", detail: "+€336 · +3 hr 9 min" },
          { label: "Cover-up", detail: "+€250 · +1 hr 35 min" },
        ],
      },
    },
  ];
};

type StoreValue = {
  business: BusinessConfig;
  requests: BookingRequest[];
  updateBusiness: (updater: (draft: BusinessConfig) => BusinessConfig) => void;
  addRequest: (request: BookingRequest) => void;
  setRequestStatus: (id: string, status: BookingRequest["status"]) => void;
  updateRequest: (id: string, patch: Partial<BookingRequest>) => void;
  resetAll: () => void;
};

// Keep one context instance across hot reloads so the provider and consumers always match.
const contextHolder = globalThis as typeof globalThis & {
  __nookStoreContext?: React.Context<StoreValue | null>;
};
const StoreContext = (contextHolder.__nookStoreContext ??= createContext<StoreValue | null>(null));

const read = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export function NookProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useState<BusinessConfig>(defaultBusiness);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setBusiness(read(CONFIG_KEY, defaultBusiness));
    setRequests(read(REQUESTS_KEY, seedRequests()));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(business));
  }, [business, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
  }, [requests, hydrated]);

  const updateBusiness = useCallback(
    (updater: (draft: BusinessConfig) => BusinessConfig) => setBusiness((prev) => updater(prev)),
    [],
  );

  const addRequest = useCallback(
    (request: BookingRequest) => setRequests((prev) => [request, ...prev]),
    [],
  );

  const setRequestStatus = useCallback(
    (id: string, status: BookingRequest["status"]) =>
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r))),
    [],
  );

  const updateRequest = useCallback(
    (id: string, patch: Partial<BookingRequest>) =>
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    [],
  );

  const resetAll = useCallback(() => {
    setBusiness(defaultBusiness);
    setRequests(seedRequests());
  }, []);

  const value = useMemo(
    () => ({
      business,
      requests,
      updateBusiness,
      addRequest,
      setRequestStatus,
      updateRequest,
      resetAll,
    }),
    [business, requests, updateBusiness, addRequest, setRequestStatus, updateRequest, resetAll],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useNook = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useNook must be used inside NookProvider");
  return ctx;
};
