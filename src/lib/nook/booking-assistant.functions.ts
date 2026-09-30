import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const assistantInput = z.object({
  message: z.string().trim().min(2).max(500),
  history: z
    .array(
      z.object({
        role: z.enum(["assistant", "customer"]),
        text: z.string().trim().min(1).max(700),
      }),
    )
    .max(8),
});

type GatewayReply = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

/** Answers general questions without exposing the project's AI key to the browser. */
export const askBookingAssistant = createServerFn({ method: "POST" })
  .inputValidator((input) => assistantInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("The booking assistant is unavailable");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite",
        max_tokens: 260,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: `You are the brief, warm booking assistant for Stillroom Tattoo in Malmö. Answer the visitor's actual question directly in the language they use, in 2–4 short sentences. Questions may be in English or Italian. You can discuss tattoos, appointment preparation, what to expect, and the booking process. Do not force every answer back to the booking form. Do not pretend to be a person or an artist.

Reliable general guidance: tattooing causes some pain and discomfort, and pain varies by person and placement. A visitor can eat beforehand and bring water. If shaving is needed, the artist can prepare the area with a clean single-use razor; do not tell visitors to shave irritated or broken skin. A fresh tattoo needs the artist's specific aftercare instructions. Do not recommend alcohol or drugs before a tattoo. If the visitor mentions a skin infection, illness, medication, allergies, pregnancy, or a medical condition, encourage them to speak with a qualified clinician and the studio before the appointment. Do not diagnose, promise safety or painlessness, prescribe medication, or invent studio policies, prices, availability, or booking status. If you do not know a studio-specific answer, say so plainly and suggest asking the studio. Never claim that a booking has been made or confirmed. The visitor must review a time and submit the booking form themselves.`,
          },
          ...data.history.map((item) => ({
            role: item.role === "customer" ? "user" : "assistant",
            content: item.text,
          })),
          { role: "user", content: data.message },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      console.error("Booking assistant gateway returned", response.status);
      throw new Error("The booking assistant is unavailable");
    }
    const result = (await response.json()) as GatewayReply;
    const answer = result.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("The booking assistant returned no answer");
    return { answer: answer.slice(0, 1000) };
  });
