import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { defaultBusiness } from "./config";
import type { Answers, BookingRequest, BusinessConfig } from "./types";

type RequestRow = Database["public"]["Tables"]["booking_requests"]["Row"];

type StoreValue = {
  business: BusinessConfig;
  requests: BookingRequest[];
  loaded: boolean;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toBusiness = (config: Json | null): BusinessConfig => {
  if (!isRecord(config) || !Array.isArray(config["services"])) return defaultBusiness;
  const saved = config as unknown as BusinessConfig;
  // Configs saved before a policy existed pick up its default value.
  return { ...saved, policies: { ...defaultBusiness.policies, ...saved.policies } };
};

const toStatus = (status: string): BookingRequest["status"] =>
  status === "confirmed" || status === "declined" ? status : "pending";

const toRequest = (row: RequestRow): BookingRequest => {
  const quote = (isRecord(row.quote) ? row.quote : {}) as Partial<BookingRequest["quote"]>;
  return {
    id: row.id,
    createdAt: row.created_at,
    customerName: row.customer_name,
    contact: row.contact,
    phone: row.phone,
    notes: row.notes,
    serviceId: row.service_id,
    answers: (isRecord(row.answers) ? row.answers : {}) as Answers,
    date: row.appointment_date,
    time: row.appointment_time.slice(0, 5),
    memberId: row.member_id || "unassigned",
    ...(row.flash_design_key ? { flashDesignId: row.flash_design_key } : {}),
    referencePaths: row.reference_paths,
    status: toStatus(row.status),
    quote: {
      low: quote.low ?? 0,
      high: quote.high ?? 0,
      duration: quote.duration ?? 0,
      deposit: quote.deposit ?? 0,
      requiresReview: quote.requiresReview ?? false,
      reviewReasons: quote.reviewReasons ?? [],
      lines: quote.lines ?? [],
    },
  };
};

const toRowPatch = (patch: Partial<BookingRequest>) => ({
  ...(patch.status ? { status: patch.status } : {}),
  ...(patch.date ? { appointment_date: patch.date } : {}),
  ...(patch.time ? { appointment_time: patch.time } : {}),
  ...(patch.memberId ? { member_id: patch.memberId } : {}),
  ...(patch.quote ? { quote: patch.quote as unknown as Json } : {}),
});

export function NookProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useState<BusinessConfig>(defaultBusiness);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [settings, bookings] = await Promise.all([
        supabase.from("studio_settings").select("config").eq("id", "main").maybeSingle(),
        // Only owners can read requests; everyone else gets an empty list.
        supabase.from("booking_requests").select("*").order("appointment_date"),
      ]);
      if (cancelled) return;
      setBusiness(toBusiness(settings.data?.config ?? null));
      setRequests((bookings.data ?? []).map(toRequest));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Owner edits are saved to the database shortly after the last change.
  useEffect(() => {
    if (!loaded || !dirty.current) return;
    const timer = window.setTimeout(async () => {
      dirty.current = false;
      const { error } = await supabase.from("studio_settings").upsert({
        id: "main",
        business_name: business.name,
        location: business.location,
        currency: business.policies.currency,
        services: business.services as unknown as Json,
        policies: business.policies as unknown as Json,
        config: business as unknown as Json,
      });
      if (error) toast.error("Could not save your changes. Check your connection and try again.");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [business, loaded]);

  const updateBusiness = useCallback((updater: (draft: BusinessConfig) => BusinessConfig) => {
    dirty.current = true;
    setBusiness((prev) => updater(prev));
  }, []);

  const addRequest = useCallback(
    (request: BookingRequest) => setRequests((prev) => [request, ...prev]),
    [],
  );

  const updateRequest = useCallback((id: string, patch: Partial<BookingRequest>) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    void supabase
      .from("booking_requests")
      .update(toRowPatch(patch))
      .eq("id", id)
      .then(({ error }) => {
        if (error) toast.error("Could not save the booking change.");
      });
  }, []);

  const setRequestStatus = useCallback(
    (id: string, status: BookingRequest["status"]) => updateRequest(id, { status }),
    [updateRequest],
  );

  const resetAll = useCallback(() => {
    dirty.current = true;
    setBusiness(defaultBusiness);
  }, []);

  const value = useMemo(
    () => ({
      business,
      requests,
      loaded,
      updateBusiness,
      addRequest,
      setRequestStatus,
      updateRequest,
      resetAll,
    }),
    [
      business,
      requests,
      loaded,
      updateBusiness,
      addRequest,
      setRequestStatus,
      updateRequest,
      resetAll,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useNook = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useNook must be used inside NookProvider");
  return ctx;
};
