import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

export type BookingEmailKind = "received" | "confirmed" | "changed" | "declined";

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
}

const headings: Record<BookingEmailKind, string> = {
  received: "We got your request",
  confirmed: "Your booking is confirmed",
  changed: "Your booking has changed",
  declined: "About your booking request",
};

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
}: BookingUpdateProps) {
  const intro: Record<BookingEmailKind, string> = {
    received: `Thanks for your request. ${studioName} will review it and email you once it is confirmed.`,
    confirmed: `${studioName} has confirmed your appointment.`,
    changed: `${studioName} updated your appointment. Here are the new details.`,
    declined: `${studioName} can't take this booking. Feel free to send a new request with different details.`,
  };
  const showDetails = kind !== "declined";
  const showDeposit = (kind === "confirmed" || kind === "changed") && deposit !== "";
  return (
    <Html lang="en">
      <Head />
      <Preview>{headings[kind]}</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily: "Manrope, Arial, sans-serif",
          color: "#1c1917",
        }}
      >
        <Container style={{ padding: "32px 24px", maxWidth: "520px" }}>
          <Heading style={{ fontSize: "26px", lineHeight: "1.15", margin: "0 0 16px" }}>
            {headings[kind]}
          </Heading>
          <Text style={{ fontSize: "15px", lineHeight: "1.6" }}>Hi {customerName},</Text>
          <Text style={{ fontSize: "15px", lineHeight: "1.6" }}>{intro[kind]}</Text>
          {showDetails && (
            <Section
              style={{
                borderTop: "1px solid #d6d3d1",
                borderBottom: "1px solid #d6d3d1",
                padding: "12px 0",
                margin: "16px 0",
              }}
            >
              <Text style={{ fontSize: "15px", margin: "4px 0" }}>
                When: {date} at {time}
              </Text>
              {priceRange && (
                <Text style={{ fontSize: "15px", margin: "4px 0" }}>
                  Estimated price: {priceRange}
                </Text>
              )}
            </Section>
          )}
          {showDeposit && (
            <Section style={{ margin: "20px 0 8px" }}>
              <Text style={{ fontSize: "15px", lineHeight: "1.6", margin: "0 0 16px" }}>
                A deposit of {deposit} is due within {depositDueHours} hours to hold your spot.
              </Text>
              {paymentUrl && (
                <>
                  <Button
                    href={paymentUrl}
                    style={{
                      backgroundColor: "#a64327",
                      borderRadius: "2px",
                      color: "#fffaf3",
                      display: "inline-block",
                      fontSize: "14px",
                      fontWeight: 700,
                      padding: "12px 20px",
                      textDecoration: "none",
                    }}
                  >
                    Pay deposit
                  </Button>
                  <Text
                    style={{
                      color: "#78716c",
                      fontSize: "12px",
                      lineHeight: "1.5",
                      margin: "10px 0 0",
                    }}
                  >
                    Payment demo only. No money will be taken.
                  </Text>
                </>
              )}
            </Section>
          )}
          <Text style={{ fontSize: "13px", color: "#57534e", marginTop: "24px" }}>
            Questions? Just reply to the studio directly. The final price is confirmed at your
            appointment.
          </Text>
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
    kind: "confirmed",
    studioName: "Ember & Thread",
    customerName: "Jane",
    date: "12 Oct 2026",
    time: "14:00",
    priceRange: "SEK 1,800 to 2,200",
    deposit: "SEK 440",
    depositDueHours: 24,
    paymentUrl: "https://example.com/payment-demo/preview",
  },
} satisfies TemplateEntry;
