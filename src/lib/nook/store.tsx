import { normalizeSavedBusiness } from "@/lib/nook/placement";
import { alignSizeGuideLabels } from "@/lib/nook/size-guide";
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
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { defaultBusiness } from "./config";
import { currentStudioName } from "./studio-brand";
import { notifyBookingChange } from "./booking-emails.functions";
import { syncOwnerBookingCalendar } from "./owner-calendar.functions";
import type { Answers, BookingRequest, BusinessConfig } from "./types";

type RequestRow = Database["public"]["Tables"]["booking_requests"]["Row"];

/** Where the owner's studio setup is in the autosave cycle. */
export type SaveState = "saved" | "unsaved" | "saving" | "error";

type StoreValue = {
  business: BusinessConfig;
  requests: BookingRequest[];
  loaded: boolean;
  /** Set when the studio setup or bookings could not be read; nothing may be saved then. */
  loadError: string | null;
  saveState: SaveState;
  retrySave: () => void;
  updateBusiness: (updater: (draft: BusinessConfig) => BusinessConfig) => void;
  addRequest: (request: BookingRequest) => void;
  /** Permanently deletes every cancelled or declined booking. Resolves to how many were removed. */
  deleteCancelledNow: () => Promise<number | null>;
  /** Resolves to true once the database has the change. */
  setRequestStatus: (
    id: string,
    status: BookingRequest["status"],
    reason?: string,
  ) => Promise<boolean>;
  /** Resolves to true once the database has the change; the screen rolls back if it fails. */
  updateRequest: (id: string, patch: Partial<BookingRequest>) => Promise<boolean>;
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
  return alignSizeGuideLabels(
    normalizeSavedBusiness({
      ...saved,
      name: currentStudioName(saved.name),
      policies: { ...defaultBusiness.policies, ...saved.policies },
    }),
  );
};

const toStatus = (status: string): BookingRequest["status"] =>
  status === "confirmed" || status === "awaiting_deposit" || status === "declined"
    ? status
    : "pending";

const toRequest = (row: RequestRow): BookingRequest => {
  const quote = (isRecord(row.quote) ? row.quote : {}) as Partial<BookingRequest["quote"]>;
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    ...(row.deposit_paid_at ? { depositPaidAt: row.deposit_paid_at } : {}),
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

export function NookProvider({
  children,
  includeBookings = false,
}: {
  children: ReactNode;
  includeBookings?: boolean;
}) {
  const syncCalendar = useServerFn(syncOwnerBookingCalendar);
  const [business, setBusiness] = useState<BusinessConfig>(defaultBusiness);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveRevision, setSaveRevision] = useState(0);
  const dirty = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [settings, bookings] = await Promise.all([
        supabase.from("studio_settings").select("config").eq("id", "main").maybeSingle(),
        // Only owners can read requests; everyone else gets an empty list.
        includeBookings
          ? supabase.from("booking_requests").select("*").order("appointment_date")
          : Promise.resolve({ data: [] as RequestRow[], error: null }),
      ]);
      if (cancelled) return;
      // Never fall back to the defaults on a failed read: the next autosave would overwrite the real setup.
      const error = settings.error ?? bookings.error;
      if (error) {
        setLoadError(error.message);
        toast.error("Could not load the studio. Reload the page to try again.");
        return;
      }
      setBusiness(toBusiness(settings.data?.config ?? null));
      setRequests((bookings.data ?? []).map(toRequest));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [includeBookings]);

  // Keep the owner's booking list current: a customer paying a deposit elsewhere
  // should appear as confirmed without reloading the page.
  useEffect(() => {
    if (!includeBookings || !loaded || loadError) return;
    let cancelled = false;
    const refresh = async () => {
      const { data, error } = await supabase
        .from("booking_requests")
        .select("*")
        .order("appointment_date");
      if (cancelled || error || !data) return;
      setRequests(data.map(toRequest));
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 20_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [includeBookings, loaded, loadError]);

  // Owner edits are saved to the database shortly after the last change.
  useEffect(() => {
    if (!loaded || !dirty.current) return;
    const timer = window.setTimeout(async () => {
      dirty.current = false;
      setSaveState("saving");
      const { error } = await supabase.from("studio_settings").upsert({
        id: "main",
        business_name: business.name,
        location: business.location,
        currency: business.policies.currency,
        services: business.services as unknown as Json,
        policies: business.policies as unknown as Json,
        config: business as unknown as Json,
      });
      if (error) {
        dirty.current = true;
        setSaveState("error");
        toast.error("Could not save your changes. Check your connection and try again.");
        return;
      }
      // A newer edit arrived while this one was saving; its own timer will save it.
      setSaveState(dirty.current ? "unsaved" : "saved");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [business, loaded, saveRevision]);

  const retrySave = useCallback(() => {
    dirty.current = true;
    setSaveState("unsaved");
    setSaveRevision((revision) => revision + 1);
  }, []);

  const updateBusiness = useCallback((updater: (draft: BusinessConfig) => BusinessConfig) => {
    dirty.current = true;
    setSaveState("unsaved");
    setBusiness((prev) => updater(prev));
  }, []);

  const addRequest = useCallback(
    (request: BookingRequest) => setRequests((prev) => [request, ...prev]),
    [],
  );

  const updateRequest = useCallback(
    async (id: string, patch: Partial<BookingRequest>, reason?: string): Promise<boolean> => {
      const previous = requests.find((request) => request.id === id);
      setRequests((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          return { ...r, ...patch, updatedAt: new Date().toISOString() };
        }),
      );
      const { error } = await supabase
        .from("booking_requests")
        .update(toRowPatch(patch))
        .eq("id", id);
      if (error) {
        // Put the booking back the way the database still has it.
        if (previous) {
          const restored = previous;
          setRequests((prev) => prev.map((r) => (r.id === id ? restored : r)));
        }
        toast.error("Could not save the booking change. Nothing was changed.");
        return false;
      }
      if (patch.status || patch.date || patch.time || patch.memberId || patch.quote) {
        try {
          await syncCalendar({ data: { id } });
        } catch {
          toast.error("Booking saved, but Google Calendar did not sync. Retry from the calendar.");
        }
      }
      // Only send a status email when the status really changes; everything else is "changed".
      const kind =
        patch.status && patch.status !== previous?.status
          ? patch.status === "confirmed" ||
            patch.status === "awaiting_deposit" ||
            patch.status === "declined"
            ? patch.status
            : null
          : patch.date || patch.time || patch.memberId || patch.quote
            ? "changed"
            : null;
      if (kind) {
        notifyBookingChange({ data: { id, kind, ...(reason ? { reason } : {}) } })
          .then((result) => {
            if (result.sent) toast.success("The customer has been emailed.");
            else toast.error("Booking saved, but the customer email was not sent.");
          })
          .catch(() => toast.error("Saved, but the email to the customer could not be sent."));
      }
      return true;
    },
    [requests, syncCalendar],
  );

  // Retention: cancelled bookings go after 15 days, past ones after 100 (see purge_expired_bookings).
  useEffect(() => {
    if (!includeBookings || !loaded || loadError) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc("purge_expired_bookings" as never);
      if (cancelled) return;
      if (error) {
        toast.error(`Could not clean up old bookings: ${error.message}`);
        return;
      }
      const removed = data as unknown as { cancelled?: number; past?: number } | null;
      if (!removed || (removed.cancelled ?? 0) + (removed.past ?? 0) === 0) return;
      const { data: fresh, error: refreshError } = await supabase
        .from("booking_requests")
        .select("*")
        .order("appointment_date");
      if (cancelled) return;
      if (refreshError || !fresh) {
        toast.error(
          "Old bookings were removed, but the list could not be refreshed. Reload the page.",
        );
        return;
      }
      setRequests(fresh.map(toRequest));
    })();
    return () => {
      cancelled = true;
    };
  }, [includeBookings, loaded, loadError]);

  const deleteCancelledNow = useCallback(async (): Promise<number | null> => {
    const { data, error } = await supabase
      .from("booking_requests")
      .delete()
      .eq("status", "declined")
      .select("id");
    if (error) {
      toast.error(`Could not delete the cancelled bookings: ${error.message}`);
      return null;
    }
    const removed = new Set(data.map((row) => row.id));
    setRequests((prev) => prev.filter((request) => !removed.has(request.id)));
    return removed.size;
  }, []);

  const setRequestStatus = useCallback(
    (id: string, status: BookingRequest["status"], reason?: string) =>
      updateRequest(id, { status }, reason),
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
      loadError,
      saveState,
      retrySave,
      updateBusiness,
      addRequest,
      deleteCancelledNow,
      setRequestStatus,
      updateRequest,
      resetAll,
    }),
    [
      business,
      requests,
      loaded,
      loadError,
      saveState,
      retrySave,
      updateBusiness,
      addRequest,
      deleteCancelledNow,
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
