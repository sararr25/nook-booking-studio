import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNook } from "@/lib/nook/store";
import { formatMoney } from "@/lib/nook/engine";
import { createOwnerBooking } from "@/lib/nook/owner-booking.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const field =
  "mt-1 block min-h-11 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none focus:border-foreground";

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** Owner-only form for bookings taken by phone, DM or in person. */
export function OwnerAddBooking() {
  const { business, addRequest } = useNook();
  const create = useServerFn(createOwnerBooking);
  const services = business.services.filter((service) => service.id !== "flash");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    customerName: "",
    email: "",
    phone: "",
    serviceId: services[0]?.id ?? "",
    memberId: "",
    date: todayKey(),
    time: "12:00",
    durationMinutes: services[0]?.baseDuration ?? 60,
    price: services[0]?.basePrice ?? 0,
    status: "confirmed" as "confirmed" | "awaiting_deposit",
    notifyCustomer: true,
    notes: "",
  }));
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const service = services.find((item) => item.id === form.serviceId);
  const deposit = service ? Math.round((form.price * service.depositPercent) / 100) : 0;
  const currency = business.policies.currency;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.memberId) {
      setError("Choose an artist.");
      return;
    }
    setSaving(true);
    setError(null);
    const id = crypto.randomUUID();
    try {
      const result = await create({
        data: { id, ...form, email: form.email.trim(), phone: form.phone.trim() },
      });
      addRequest({
        id,
        createdAt: new Date().toISOString(),
        customerName: form.customerName.trim(),
        contact: form.email.trim() || form.phone.trim(),
        phone: form.phone.trim(),
        notes: form.notes ? `Added by owner. ${form.notes}` : "Added by owner.",
        serviceId: form.serviceId,
        answers: {},
        quote: {
          low: form.price,
          high: form.price,
          duration: form.durationMinutes,
          deposit: form.status === "awaiting_deposit" ? result.deposit : 0,
          requiresReview: false,
          reviewReasons: [],
          lines: [{ label: "Set by owner", detail: `${form.durationMinutes} min` }],
        },
        date: form.date,
        time: form.time,
        memberId: form.memberId,
        status: form.status,
      });
      const extras = [
        form.status === "confirmed"
          ? result.calendarAdded
            ? "added to Google Calendar"
            : "not added to Google Calendar"
          : null,
        form.notifyCustomer && form.email
          ? result.emailSent
            ? "email sent"
            : "email not sent"
          : null,
      ].filter(Boolean);
      toast.success(`Booking saved${extras.length ? `, ${extras.join(", ")}` : ""}.`);
      setOpen(false);
      setForm((previous) => ({ ...previous, customerName: "", email: "", phone: "", notes: "" }));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save the booking.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-foreground px-4 text-sm font-semibold text-card transition-colors hover:bg-brand hover:text-brand-foreground"
        >
          <Plus className="size-4" aria-hidden="true" /> Add booking
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-sm sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add a booking</DialogTitle>
          <DialogDescription>
            For bookings taken by phone, DM or in person. Nook still blocks double bookings for the
            artist.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium sm:col-span-2">
            Customer name
            <input
              required
              value={form.customerName}
              onChange={(event) => set("customerName", event.target.value)}
              className={field}
            />
          </label>
          <label className="text-xs font-medium">
            Phone
            <input
              required
              type="tel"
              minLength={6}
              value={form.phone}
              onChange={(event) => set("phone", event.target.value)}
              className={field}
            />
          </label>
          <label className="text-xs font-medium">
            Email <span className="text-muted-foreground">(optional)</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => set("email", event.target.value)}
              className={field}
            />
          </label>
          <label className="text-xs font-medium">
            Service
            <select
              value={form.serviceId}
              onChange={(event) => {
                const next = services.find((item) => item.id === event.target.value);
                setForm((previous) => ({
                  ...previous,
                  serviceId: event.target.value,
                  durationMinutes: next?.baseDuration ?? previous.durationMinutes,
                  price: next?.basePrice ?? previous.price,
                }));
              }}
              className={field}
            >
              {services.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            Artist
            <select
              required
              value={form.memberId}
              onChange={(event) => set("memberId", event.target.value)}
              className={field}
            >
              <option value="" disabled>
                Choose an artist
              </option>
              {business.team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            Date
            <input
              required
              type="date"
              min={todayKey()}
              value={form.date}
              onChange={(event) => set("date", event.target.value)}
              className={field}
            />
          </label>
          <label className="text-xs font-medium">
            Time
            <input
              required
              type="time"
              step={900}
              value={form.time}
              onChange={(event) => set("time", event.target.value)}
              className={field}
            />
          </label>
          <label className="text-xs font-medium">
            Length (minutes)
            <input
              required
              type="number"
              min={15}
              max={720}
              step={15}
              value={form.durationMinutes}
              onChange={(event) => set("durationMinutes", Number(event.target.value))}
              className={field}
            />
          </label>
          <label className="text-xs font-medium">
            Price ({currency})
            <input
              required
              type="number"
              min={0}
              step={5}
              value={form.price}
              onChange={(event) => set("price", Number(event.target.value))}
              className={field}
            />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="text-xs font-medium">Status</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["confirmed", "Confirmed", "Deposit handled already, or none needed."],
                  [
                    "awaiting_deposit",
                    "Waiting for deposit",
                    `Email a ${formatMoney(deposit, currency)} deposit link (${service?.depositPercent ?? 0}%).`,
                  ],
                ] as const
              ).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={form.status === value}
                  onClick={() => set("status", value)}
                  className={cn(
                    "nook-choice min-h-11 rounded-sm border border-border p-3 text-left text-sm",
                    form.status === value && "nook-selected",
                  )}
                >
                  <span className="block font-semibold">{label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.notifyCustomer}
              onChange={(event) => set("notifyCustomer", event.target.checked)}
              className="size-4 accent-[var(--foreground)]"
            />
            Email the customer {form.status === "confirmed" ? "a confirmation" : "the deposit link"}
            {!form.email && <span className="text-muted-foreground">(needs an email)</span>}
          </label>
          <label className="text-xs font-medium sm:col-span-2">
            Notes <span className="text-muted-foreground">(optional)</span>
            <textarea
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              rows={3}
              className={cn(field, "py-2")}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 rounded-sm border border-border px-4 text-sm hover:border-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-sm bg-foreground px-5 text-sm font-semibold text-card transition-colors hover:bg-brand hover:text-brand-foreground disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save booking"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
