import { useState } from "react";
import { ChevronRight, Download, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { BookingRequest, BusinessConfig } from "@/lib/nook/types";
import { formatMoney } from "@/lib/nook/engine";
import {
  CANCELLED_RETENTION_DAYS,
  PAST_RETENTION_DAYS,
  cancelledDaysLeft,
  daysLeftLabel,
  pastDaysLeft,
} from "@/lib/nook/retention";
import { buildXlsx, downloadXlsx, type Cell } from "@/lib/nook/xlsx-export";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ghostButton =
  "inline-flex min-h-10 items-center gap-2 rounded-sm border border-border px-3 text-sm transition-colors hover:border-foreground";

const statusLabel: Record<BookingRequest["status"], string> = {
  confirmed: "Confirmed",
  awaiting_deposit: "Awaiting deposit",
  pending: "Pending review",
  declined: "Cancelled / declined",
};

const formatDay = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function Group({
  title,
  count,
  hint,
  actions,
  children,
}: {
  title: string;
  count: number;
  hint: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-sm border border-border">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-h-10 min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronRight
            className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")}
          />
          <span className="font-display text-lg font-semibold">{title}</span>
          <span className="font-mono text-sm text-muted-foreground">{count}</span>
        </button>
        {actions}
      </div>
      <p className="px-4 pb-3 text-xs text-muted-foreground">{hint}</p>
      {open && (
        <ul className="divide-y divide-border border-t border-border">
          {count === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">Nothing here.</li>
          ) : (
            children
          )}
        </ul>
      )}
    </section>
  );
}

function Row({
  request,
  business,
  daysLeft,
  action,
}: {
  request: BookingRequest;
  business: BusinessConfig;
  daysLeft: number;
  action?: React.ReactNode;
}) {
  const service = business.services.find((s) => s.id === request.serviceId);
  const member = business.team.find((m) => m.id === request.memberId);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
      <span className="w-28 shrink-0 font-mono text-xs">
        {formatDay(request.date)}
        <span className="block text-muted-foreground">{request.time}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-medium">{request.customerName}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {service?.name ?? "Removed service"}
          {member ? ` with ${member.name}` : ""}
          {request.contact ? ` · ${request.contact}` : ""}
        </span>
      </span>
      <span className="text-right text-xs">
        <span className="block font-mono">
          {request.quote.high === 0
            ? "Free"
            : formatMoney(request.quote.high, business.policies.currency)}
        </span>
        <span className="block text-muted-foreground">{daysLeftLabel(daysLeft)}</span>
      </span>
      {action}
    </li>
  );
}

/** Past and cancelled bookings, folded away so the main list stays short. */
export function OwnerArchive({
  business,
  past,
  cancelled,
  onBackToReview,
  onDeleteCancelled,
}: {
  business: BusinessConfig;
  past: BookingRequest[];
  cancelled: BookingRequest[];
  onBackToReview: (id: string) => void;
  onDeleteCancelled: () => Promise<number | null>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const exportPast = () => {
    const currency = business.policies.currency;
    const rows: Cell[][] = past.map((r) => [
      r.date,
      r.time,
      r.customerName,
      r.contact,
      r.phone ?? "",
      business.services.find((s) => s.id === r.serviceId)?.name ?? r.serviceId,
      business.team.find((m) => m.id === r.memberId)?.name ?? "",
      statusLabel[r.status],
      r.quote.low,
      r.quote.high,
      r.quote.duration,
      r.quote.deposit,
      r.depositPaidAt ? "Yes" : "No",
      r.notes,
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadXlsx(
      `nook-past-bookings-${stamp}.xlsx`,
      buildXlsx(
        "Past bookings",
        [
          "Date",
          "Time",
          "Customer",
          "Email",
          "Phone",
          "Service",
          "Artist",
          "Status",
          `Quote from (${currency})`,
          `Quote to (${currency})`,
          "Duration (min)",
          `Deposit (${currency})`,
          "Deposit paid",
          "Notes",
        ],
        rows,
      ),
    );
    toast.success(`Exported ${rows.length} past bookings.`);
  };

  const newestFirst = (a: BookingRequest, b: BookingRequest) =>
    `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`);

  return (
    <div className="space-y-4">
      <Group
        title="Past bookings"
        count={past.length}
        hint={`Removed automatically ${PAST_RETENTION_DAYS} days after the appointment. Download an Excel file to keep them for good.`}
        actions={
          <button
            type="button"
            onClick={exportPast}
            disabled={past.length === 0}
            className={cn(ghostButton, "disabled:opacity-50")}
          >
            <Download className="size-4" /> Download Excel
          </button>
        }
      >
        {[...past].sort(newestFirst).map((r) => (
          <Row key={r.id} request={r} business={business} daysLeft={pastDaysLeft(r.date)} />
        ))}
      </Group>

      <Group
        title="Cancelled bookings"
        count={cancelled.length}
        hint={`Removed automatically ${CANCELLED_RETENTION_DAYS} days after they were cancelled or declined.`}
        actions={
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={cancelled.length === 0}
            className={cn(
              ghostButton,
              "hover:border-destructive hover:text-destructive disabled:opacity-50",
            )}
          >
            <Trash2 className="size-4" /> Delete all now
          </button>
        }
      >
        {[...cancelled]
          .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
          .map((r) => (
            <Row
              key={r.id}
              request={r}
              business={business}
              daysLeft={cancelledDaysLeft(r.updatedAt)}
              action={
                <button type="button" onClick={() => onBackToReview(r.id)} className={ghostButton}>
                  <RotateCcw className="size-4" /> Back to review
                </button>
              }
            />
          ))}
      </Group>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all cancelled bookings?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelled.length} cancelled or declined{" "}
              {cancelled.length === 1 ? "booking" : "bookings"} will be permanently deleted. This
              cannot be undone, and customers are not emailed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep them</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (event) => {
                event.preventDefault();
                setDeleting(true);
                const removed = await onDeleteCancelled();
                setDeleting(false);
                if (removed === null) return;
                setConfirmDelete(false);
                toast.success(
                  `Deleted ${removed} cancelled ${removed === 1 ? "booking" : "bookings"}.`,
                );
              }}
              className="bg-destructive text-destructive-foreground"
            >
              {deleting ? "Deleting…" : "Delete all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
