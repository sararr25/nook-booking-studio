import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

export type BookingEmailKind =
  "received" | "awaiting_deposit" | "confirmed" | "changed" | "declined";

export interface BookingUpdateProps {
  kind?: BookingEmailKind;
  studioName?: string;
  customerName?: string;
  date?: string;
  time?: string;
  priceRange?: string;
  deposit?: string;
  depositDueHours?: number;
  paymentUrl?: string;
  /** Absolute URL of Nook's light logo, shown beside "Booked with Nook". */
  nookLogoUrl?: string;
  pendingDeposit?: boolean;
  reason?: string;
  serviceName?: string;
  artistName?: string;
  duration?: string;
  location?: string;
}

// Same palette as the studio site (src/studio.css): paper, ink and cinnabar from the koi flash.
const ink = "#1c1a17";
const paper = "#f6f2ea";
const stone = "#f1ece3";
const line = "#ddd5c8";
const muted = "#5d564d";
const cinnabar = "#c8302a";
const blush = "#f3cfc6";
const green = "#2f6b4f";
const serif = "Fraunces, Georgia, 'Times New Roman', serif";
const sans = "Manrope, 'Helvetica Neue', Arial, sans-serif";
const mono = "'JetBrains Mono', Menlo, Consolas, monospace";

const headings: Record<BookingEmailKind, string> = {
  received: "We got your request",
  awaiting_deposit: "Your slot is held for you",
  confirmed: "You're booked in",
  changed: "Your booking has changed",
  declined: "About your booking request",
};

// Italic accent word in the headline, like the site's "make your *mark*".
const accents: Record<BookingEmailKind, [string, string]> = {
  received: ["We got your", "request."],
  awaiting_deposit: ["Your slot is", "held."],
  confirmed: ["You're", "booked in."],
  changed: ["A small", "change."],
  declined: ["About your", "request."],
};

const status: Record<BookingEmailKind, { label: string; color: string }> = {
  received: { label: "Request received", color: muted },
  awaiting_deposit: { label: "Pending deposit", color: cinnabar },
  confirmed: { label: "✓ Confirmed", color: green },
  changed: { label: "Updated", color: ink },
  declined: { label: "Not booked", color: muted },
};

/** "2026-10-08" → "Thursday 8 October"; anything else is shown as given. */
function prettyDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ margin: 0 }}>
      <Column style={{ padding: "7px 0", fontFamily: sans, fontSize: "13px", color: muted }}>
        {label}
      </Column>
      <Column
        align="right"
        style={{
          padding: "7px 0",
          fontFamily: mono,
          fontSize: "13px",
          color: ink,
          fontWeight: 600,
        }}
      >
        {value}
      </Column>
    </Row>
  );
}

function BookingUpdate({
  kind = "confirmed",
  studioName = "the studio",
  customerName = "there",
  date = "",
  time = "",
  priceRange = "",
  deposit = "",
  depositDueHours = 24,
  paymentUrl = "",
  nookLogoUrl = "",
  pendingDeposit = false,
  reason = "",
  serviceName = "",
  artistName = "",
  duration = "",
  location = "",
}: BookingUpdateProps) {
  const firstName = customerName.trim().split(/\s+/)[0] || "there";
  const intro: Record<BookingEmailKind, string> = {
    received: `Thank you for telling us about your idea. We'll look it over and get back to you by email, usually within a day.`,
    awaiting_deposit: `We're holding this time for you. Pay the deposit within ${depositDueHours} hours and it's yours.`,
    confirmed: `It's in the book. We're looking forward to meeting you and making something you'll love wearing.`,
    changed: `We've updated your appointment. Here are the new details, everything else stays the same.`,
    declined: `We're sorry, we can't take this booking as it is. You're very welcome to send a new request with different details.`,
  };
  const showDetails = kind !== "declined";
  const showDeposit = pendingDeposit && deposit !== "";
  const [lead, accent] = accents[kind];
  const badge = status[kind];
  const when = [prettyDate(date), time].filter(Boolean).join(", ");

  return (
    <Html lang="en">
      <Head />
      <Preview>{`${headings[kind]}${when ? ` · ${when}` : ""}`}</Preview>
      <Body style={{ backgroundColor: stone, margin: 0, padding: "24px 0", fontFamily: sans }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", backgroundColor: paper }}>
          {/* Header band: the studio wordmark on ink, like the site's top bar. */}
          <Section style={{ backgroundColor: ink, padding: "22px 32px" }}>
            <Text
              style={{
                margin: 0,
                fontFamily: serif,
                fontSize: "22px",
                color: paper,
                letterSpacing: "-0.01em",
              }}
            >
              {studioName.replace(/\s+tattoo$/i, "")}
              <span
                style={{
                  fontFamily: sans,
                  fontSize: "9px",
                  letterSpacing: "0.25em",
                  marginLeft: "8px",
                  color: blush,
                }}
              >
                TATTOO
              </span>
            </Text>
          </Section>

          <Section style={{ padding: "40px 32px 8px" }}>
            <Text
              style={{
                margin: "0 0 18px",
                display: "inline-block",
                border: `1.5px solid ${badge.color}`,
                color: badge.color,
                padding: "4px 10px",
                fontFamily: mono,
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {badge.label}
            </Text>
            <Heading
              as="h1"
              style={{
                margin: "0 0 20px",
                fontFamily: serif,
                fontWeight: 400,
                fontSize: "38px",
                lineHeight: "1.08",
                color: ink,
                letterSpacing: "-0.02em",
              }}
            >
              {lead} <em style={{ color: cinnabar, fontStyle: "italic" }}>{accent}</em>
            </Heading>
            <Text style={{ margin: "0 0 8px", fontSize: "16px", lineHeight: "1.65", color: ink }}>
              Hi {firstName},
            </Text>
            <Text style={{ margin: 0, fontSize: "16px", lineHeight: "1.65", color: ink }}>
              {intro[kind]}
            </Text>
            {kind === "declined" && reason && (
              <Text
                style={{
                  margin: "20px 0 0",
                  padding: "14px 16px",
                  borderLeft: `3px solid ${cinnabar}`,
                  backgroundColor: stone,
                  fontSize: "15px",
                  lineHeight: "1.6",
                  color: ink,
                }}
              >
                <strong>A note from the studio:</strong> {reason}
              </Text>
            )}
          </Section>

          {showDetails && (
            <Section style={{ padding: "24px 32px 8px" }}>
              {/* The booking as a ticket stub, matching the summary card on the site. */}
              <Section style={{ border: `1px solid ${ink}`, backgroundColor: "#fbf9f4" }}>
                <Section style={{ padding: "18px 20px 14px", borderBottom: `1px dashed ${line}` }}>
                  <Text
                    style={{
                      margin: 0,
                      fontFamily: mono,
                      fontSize: "10px",
                      letterSpacing: "0.12em",
                      color: muted,
                    }}
                  >
                    YOUR APPOINTMENT
                  </Text>
                  <Text
                    style={{
                      margin: "6px 0 0",
                      fontFamily: serif,
                      fontSize: "24px",
                      lineHeight: "1.2",
                      color: ink,
                    }}
                  >
                    {when || "Time to be confirmed"}
                  </Text>
                </Section>
                <Section style={{ padding: "8px 20px 10px" }}>
                  {serviceName && <DetailRow label="Booking" value={serviceName} />}
                  {artistName && <DetailRow label="Artist" value={artistName} />}
                  {duration && <DetailRow label="Length" value={duration} />}
                  {priceRange && <DetailRow label="Estimate" value={priceRange} />}
                  {location && <DetailRow label="Where" value={location} />}
                </Section>
              </Section>
            </Section>
          )}

          {showDeposit && (
            <Section style={{ padding: "24px 32px 8px" }}>
              <Text style={{ margin: "0 0 18px", fontSize: "15px", lineHeight: "1.6", color: ink }}>
                A <strong>{deposit}</strong> deposit secures your slot. It comes off your final
                price on the day.
              </Text>
              {paymentUrl && (
                <>
                  <Button
                    href={paymentUrl}
                    style={{
                      backgroundColor: ink,
                      color: paper,
                      fontFamily: sans,
                      fontSize: "15px",
                      fontWeight: 700,
                      padding: "15px 26px",
                      textDecoration: "none",
                    }}
                  >
                    Pay deposit &nbsp;→
                  </Button>
                  <Text
                    style={{
                      margin: "12px 0 0",
                      fontSize: "12px",
                      lineHeight: "1.5",
                      color: muted,
                    }}
                  >
                    Demo payment: no money is taken. The link holds your slot for {depositDueHours}{" "}
                    hours.
                  </Text>
                </>
              )}
            </Section>
          )}

          {(kind === "confirmed" || kind === "awaiting_deposit") && (
            <Section style={{ padding: "28px 32px 0" }}>
              <Text
                style={{
                  margin: "0 0 10px",
                  fontFamily: mono,
                  fontSize: "10px",
                  letterSpacing: "0.12em",
                  color: cinnabar,
                }}
              >
                BEFORE YOU COME IN
              </Text>
              {[
                "Eat a proper meal beforehand and bring some water.",
                "Wear something comfortable that leaves the area easy to reach.",
                "Skip alcohol the night before. Your skin will thank you.",
              ].map((tip) => (
                <Text
                  key={tip}
                  style={{ margin: "0 0 6px", fontSize: "14px", lineHeight: "1.6", color: ink }}
                >
                  <span style={{ color: cinnabar }}>✳</span>&nbsp;&nbsp;{tip}
                </Text>
              ))}
            </Section>
          )}

          <Section style={{ padding: "32px 32px 36px" }}>
            <Text style={{ margin: 0, fontSize: "14px", lineHeight: "1.6", color: muted }}>
              Questions or need to move things around? Just reply to this email, it comes straight
              to us. The final price is agreed together at your appointment.
            </Text>
            <Text style={{ margin: "18px 0 0", fontFamily: serif, fontSize: "17px", color: ink }}>
              See you soon,
              <br />
              <em>{studioName}</em>
            </Text>
          </Section>

          <Section style={{ backgroundColor: ink, padding: "16px 32px" }}>
            <Text style={{ margin: 0, fontSize: "11px", lineHeight: "1.6", color: "#b9b1a5" }}>
              {studioName}
              {location ? ` · ${location}` : ""} · Booked with Nook
              {nookLogoUrl && (
                <Img
                  src={nookLogoUrl}
                  width="16"
                  height="16"
                  alt="Nook"
                  style={{ display: "inline-block", verticalAlign: "-3px", marginLeft: "6px" }}
                />
              )}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: BookingUpdate,
  subject: (data: Record<string, unknown>) => {
    const kind = (data["kind"] as BookingEmailKind | undefined) ?? "confirmed";
    return headings[kind] ?? headings.confirmed;
  },
  displayName: "Booking update",
  previewData: {
    kind: "awaiting_deposit",
    studioName: "Stillroom Tattoo",
    customerName: "Nadia Berg",
    date: "2026-10-08",
    time: "11:00",
    priceRange: "€185–€235",
    deposit: "€42",
    depositDueHours: 24,
    pendingDeposit: true,
    paymentUrl: "https://example.com/payment-demo/preview",
    serviceName: "Custom tattoo",
    artistName: "Tove Lind",
    duration: "1 hr 45 min",
    location: "Ostergatan 14, Malmö",
  },
} satisfies TemplateEntry;
