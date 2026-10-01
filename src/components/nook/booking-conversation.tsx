import { useEffect, useRef, useState } from "react";
import { ArrowRight, MessageCircle, Send, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { askBookingAssistant } from "@/lib/nook/booking-assistant.functions";
import { buildQuote, formatMoney, isAnswered, visibleQuestions } from "@/lib/nook/engine";
import type { Answers, BusinessConfig, Question, Service } from "@/lib/nook/types";
import { TypedQuestion } from "./typed-question";

type Message = { role: "assistant" | "customer"; text: string };

type Props = {
  business: BusinessConfig;
  currentServiceId: string;
  currentAnswers: Answers;
  onApply: (serviceId: string, answers: Answers, notes: string) => void;
};

function nextQuestion(service: Service, answers: Answers, skipped: string[]) {
  return visibleQuestions(service, answers).find(
    (question) =>
      !skipped.includes(question.id) &&
      (question.optional ? answers[question.id] === undefined : !isAnswered(question, answers)),
  );
}

// The form labels are terse ("Size", "Placement"); in chat Nook asks the way a person at the desk would.
const CHAT_PROMPTS: Record<string, string> = {
  size: "Roughly how big are you imagining it? A guess in cm is totally fine, we'll measure together at the studio.",
  style: "What kind of look are you going for?",
  placement: "And where would you like it to live on your body?",
  coverup: "Quick one: is this going over an older tattoo, or on fresh skin?",
  extras: "Want to add anything to the session? Pick any that sound good, or skip.",
  firsttime: "Is this your first tattoo? No wrong answer, it just helps us plan a bit more time.",
  reference:
    "Now the fun part: tell me about the idea in a sentence or two. You can add reference pictures at the top of the page too.",
  sizeflash: "Great pick. How big would you like it?",
  placementflash: "And where should it go?",
  scope: "Happy to set up a chat with an artist. What's on your mind?",
  notes: "Anything you'd like the artist to know before you meet? Totally optional.",
};

function questionPrompt(question: Question) {
  return (
    CHAT_PROMPTS[question.id] ?? `${question.label}${question.help ? ` ${question.help}` : ""}`
  );
}

const ACKS = ["Got it.", "Perfect.", "Nice, noted.", "Sounds good.", "Great."];

/** A short, human acknowledgement before the next question. */
function acknowledge(question: Question, value: Answers[string], step: number) {
  const chosen = question.options?.find((option) => option.id === value)?.label;
  if (question.type === "scale")
    return `${value} ${question.unit ?? ""}, got it.`.replace(" ,", ",");
  if (question.type === "text") return "Thanks, that really helps the artist.";
  if (chosen && question.type === "single")
    return `${chosen}, ${["nice choice.", "noted.", "great."][step % 3]}`;
  return ACKS[step % ACKS.length];
}

function matchOption(question: Question, input: string) {
  const normalized = input.trim().toLowerCase();
  return question.options?.find(
    (option) => option.id.toLowerCase() === normalized || option.label.toLowerCase() === normalized,
  );
}

function answerQuestion(question: Question, input: string): Answers[string] | null {
  if (question.type === "text") return input.trim().length >= 3 ? input.trim() : null;
  if (question.type === "scale") {
    const value = Number(input.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(",", "."));
    return Number.isFinite(value) && value >= (question.min ?? 0) && value <= (question.max ?? 100)
      ? value
      : null;
  }
  if (question.type === "multi") {
    const options = question.options?.filter((option) =>
      input.toLowerCase().includes(option.label.toLowerCase()),
    );
    return options?.length ? options.map((option) => option.id) : null;
  }
  return matchOption(question, input)?.id ?? null;
}

function looksLikeQuestion(input: string) {
  return (
    input.includes("?") ||
    /^(what|how|when|where|why|will|can|could|should|do|does|is|are|would|mi|devo|posso|cosa|come|quanto|quali|serve|bisogna)\b/i.test(
      input,
    ) ||
    /\b(first tattoo|before my (tattoo|session)|pain|hurt|shav\w*|prepare|prep|seduta|depil\w*|mangiare prima)\b/i.test(
      input,
    )
  );
}

export function BookingConversation({
  business,
  currentServiceId,
  currentAnswers,
  onApply,
}: Props) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState(currentServiceId);
  const [answers, setAnswers] = useState<Answers>(currentAnswers);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState("");
  const [responding, setResponding] = useState(false);
  // "thinking" shows the dots before a reply; "typing" lasts while the reply is written out.
  const [thinking, setThinking] = useState(false);
  const [typing, setTyping] = useState(true);
  const replyTimer = useRef<number | undefined>(undefined);
  const busy = responding || thinking || typing;
  const askOnServer = useServerFn(askBookingAssistant);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hi, I'm Nook 👋 I help people get booked in at the studio. What are you dreaming of getting? Pick an option below or just tell me in your own words.",
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);
  const service = business.services.find((item) => item.id === serviceId) ?? business.services[0];
  const question = started && service ? nextQuestion(service, answers, skipped) : undefined;
  const complete = started && service && !question;

  useEffect(() => {
    if (open)
      endRef.current?.scrollIntoView({
        block: "end",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
  }, [messages, open, thinking]);

  useEffect(() => () => window.clearTimeout(replyTimer.current), []);

  function reply(assistant: string) {
    setThinking(false);
    setTyping(true);
    setMessages((previous) => [...previous, { role: "assistant", text: assistant }]);
  }

  function append(customer: string, assistant: string) {
    setMessages((previous) => [...previous, { role: "customer", text: customer }]);
    setDraft("");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reply(assistant);
      return;
    }
    setThinking(true);
    window.clearTimeout(replyTimer.current);
    replyTimer.current = window.setTimeout(
      () => reply(assistant),
      500 + Math.min(700, assistant.length * 6),
    );
  }

  function selectService(next: Service, label: string) {
    const nextAnswers = next.id === serviceId ? answers : {};
    setServiceId(next.id);
    setAnswers(nextAnswers);
    setSkipped([]);
    setStarted(true);
    const first = nextQuestion(next, nextAnswers, []);
    append(
      label,
      first
        ? `${next.name}, lovely. ${questionPrompt(first)}`
        : "I have enough to prepare the booking. Review the details next.",
    );
  }

  async function answerOpenQuestion(input: string) {
    if (responding) return;
    const history = messages.slice(-8);
    setResponding(true);
    setThinking(true);
    setMessages((previous) => [...previous, { role: "customer", text: input }]);
    setDraft("");
    try {
      const result = await askOnServer({ data: { message: input, history } });
      reply(result.answer);
    } catch {
      reply(
        "I can't answer that reliably right now. You can ask the studio directly or add it to your booking notes for the artist.",
      );
    } finally {
      setResponding(false);
    }
  }

  function sendAnswer(raw: string) {
    const input = raw.trim();
    if (!input || responding) return;
    if (!started) {
      const selected = business.services.find((item) =>
        input.toLowerCase().includes(item.name.toLowerCase()),
      );
      if (selected) {
        selectService(selected, input);
      } else if (looksLikeQuestion(input)) {
        void answerOpenQuestion(input);
      } else {
        setNotes(input);
        append(
          input,
          "Sounds exciting! Which of these is closest to what you have in mind? Then I'll ask a few quick things.",
        );
      }
      return;
    }
    if (!service) return;

    const lower = input.toLowerCase();
    if (/\b(price|cost|how much|deposit)\b/.test(lower)) {
      const quote = buildQuote(business, service, answers);
      append(
        input,
        `Based on the details so far, the estimate is ${formatMoney(quote.low, business.policies.currency)}–${formatMoney(quote.high, business.policies.currency)}. The ${service.depositPercent}% deposit is needed before confirmation; the payment link follows the request. ${question ? questionPrompt(question) : "You can review the quote before choosing a time."}`,
      );
      return;
    }
    if (/\b(availability|available|when|date|time)\b/.test(lower) && input.endsWith("?")) {
      append(
        input,
        `Available times are checked against the studio and Google Calendar in the next part of booking. ${question ? questionPrompt(question) : "Review the details to continue."}`,
      );
      return;
    }
    if (/\b(cancel|reschedul)\b/.test(lower) && input.endsWith("?")) {
      append(
        input,
        `The studio's cancellation window is ${business.policies.cancellationHours} hours. ${question ? questionPrompt(question) : "Review the details to continue."}`,
      );
      return;
    }
    if (looksLikeQuestion(input)) {
      void answerOpenQuestion(input);
      return;
    }
    if (!question) {
      setNotes((previous) => [previous, input].filter(Boolean).join("\n"));
      append(input, "I've added that to your notes. Review the booking details to continue.");
      return;
    }
    if (question.optional && /^(skip|none|nothing|no)$/i.test(input)) {
      const nextSkipped = [...skipped, question.id];
      setSkipped(nextSkipped);
      const following = nextQuestion(service, answers, nextSkipped);
      append(
        input,
        following
          ? questionPrompt(following)
          : "That's enough to prepare your booking. Review the details next.",
      );
      return;
    }
    const value = answerQuestion(question, input);
    if (value === null) {
      append(
        input,
        question.type === "scale"
          ? `Could you give me a size between ${question.min ?? 0} and ${question.max ?? 100} ${question.unit ?? "units"}.`
          : "Hmm, I didn't quite catch that. Could you tap one of the options below?",
      );
      return;
    }
    const nextAnswers = { ...answers, [question.id]: value };
    setAnswers(nextAnswers);
    const following = nextQuestion(service, nextAnswers, skipped);
    const ack = acknowledge(question, value, Object.keys(nextAnswers).length);
    append(
      input,
      following
        ? `${ack} ${questionPrompt(following)}`
        : `${ack} That's everything I need! Have a look at the summary and pick a time that suits you.`,
    );
  }

  return (
    <div className="border-b border-border bg-background/70 px-5 py-3 sm:px-10 lg:px-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Have a specific request? Talk it through, then review the booking.
        </p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="booking-conversation"
          className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-foreground px-4 text-sm font-semibold text-foreground transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          {open ? (
            <X size={16} aria-hidden="true" />
          ) : (
            <MessageCircle size={16} aria-hidden="true" />
          )}
          {open ? "Close conversation" : "Ask about booking"}
        </button>
      </div>
      {open && (
        <section
          id="booking-conversation"
          aria-label="Booking conversation"
          className="nook-enter nook-chat mt-4 overflow-hidden rounded-[20px] border border-border bg-card"
        >
          <header className="flex items-center gap-3 border-b border-border bg-brand-soft/60 px-4 py-3 sm:px-5">
            <NookFace size="lg" thinking={thinking} />
            <div className="min-w-0">
              <p className="font-display text-base font-bold leading-tight">Nook</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-600" />
                {thinking ? "typing…" : `${business.name}'s booking helper`}
              </p>
            </div>
          </header>
          <div className="p-4 sm:p-5">
            <div
              className="max-h-96 space-y-2.5 overflow-y-auto pr-1"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {messages.map((message, index) =>
                message.role === "assistant" ? (
                  <div key={index} className="nook-enter flex max-w-[88%] items-end gap-2">
                    {messages[index + 1]?.role === "assistant" ? (
                      <span aria-hidden="true" className="w-9 shrink-0" />
                    ) : (
                      <NookFace />
                    )}
                    <div className="min-w-0">
                      <p className="rounded-[18px] rounded-bl-[6px] bg-brand-soft px-4 py-2.5 text-[15px] leading-relaxed text-foreground">
                        {index === messages.length - 1 ? (
                          <TypedQuestion
                            text={message.text}
                            msPerCharacter={26}
                            maxDuration={2600}
                            onDone={() => setTyping(false)}
                          />
                        ) : (
                          message.text
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div key={index} className="nook-enter ml-auto max-w-[80%] text-right">
                    <p className="inline-block rounded-[18px] rounded-br-[6px] bg-foreground px-4 py-2.5 text-left text-[15px] leading-relaxed text-card">
                      {message.text}
                    </p>
                  </div>
                ),
              )}
              {thinking && (
                <div className="nook-enter flex items-end gap-2" role="status">
                  <NookFace thinking />
                  <span className="sr-only">Nook is typing</span>
                  <span
                    aria-hidden="true"
                    className="nook-dots inline-flex gap-1 rounded-[18px] rounded-bl-[6px] bg-brand-soft px-4 py-3.5"
                  >
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              )}
              <div ref={endRef} />
            </div>
            {!started && !busy && (
              <div className="mt-4 flex flex-wrap gap-2">
                {business.services.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy}
                    onClick={() => selectService(item, item.name)}
                    className="nook-reply min-h-11 rounded-full border border-brand-ink/40 bg-background px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            )}
            {!started && !busy && (
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  "Will it hurt?",
                  "Should I shave?",
                  "Can I eat beforehand?",
                  "First tattoo tips",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={busy}
                    onClick={() => void answerOpenQuestion(suggestion)}
                    className="min-h-9 rounded-full bg-muted px-3.5 text-xs text-muted-foreground transition-colors hover:bg-brand-soft hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            {question?.options && !busy && (
              <div className="mt-4 flex flex-wrap gap-2">
                {question.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={busy}
                    onClick={() => sendAnswer(option.label)}
                    className="nook-reply min-h-11 rounded-full border border-brand-ink/40 bg-background px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
                  >
                    {option.label}
                  </button>
                ))}
                {question.optional && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => sendAnswer("Skip")}
                    className="min-h-11 rounded-sm px-3 py-2 text-sm underline focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
                  >
                    Skip
                  </button>
                )}
              </div>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                sendAnswer(draft);
              }}
              className="mt-5 flex gap-2 rounded-full border border-input bg-background p-1.5 focus-within:border-foreground"
            >
              <label className="sr-only" htmlFor="booking-chat-input">
                Your message
              </label>
              <input
                id="booking-chat-input"
                value={draft}
                disabled={busy}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={
                  question?.type === "scale"
                    ? `Size in ${question.unit ?? "units"}`
                    : "Write to Nook…"
                }
                className="min-h-10 min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || busy}
                aria-label="Send message"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-card transition-colors hover:bg-brand hover:text-brand-foreground disabled:opacity-40 disabled:hover:bg-foreground disabled:hover:text-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              >
                <Send size={17} aria-hidden="true" />
              </button>
            </form>
            {complete && !busy && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onApply(service.id, answers, notes);
                  setOpen(false);
                }}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-sm bg-foreground px-5 text-sm font-semibold text-card transition-colors hover:bg-brand hover:text-brand-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50"
              >
                Review booking <ArrowRight size={17} aria-hidden="true" />
              </button>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Nook prepares a draft for you. Nothing is booked until you pick a time and confirm.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Nook's face: a little peach ink-pot character with a top-knot, rosy cheeks and
 * blinking eyes. While thinking the eyes glance up and the mouth becomes a small "o".
 */
function NookFace({ thinking = false, size = "sm" }: { thinking?: boolean; size?: "sm" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={`nook-face relative flex shrink-0 items-center justify-center rounded-full bg-brand ring-2 ring-card ${size === "lg" ? "size-12" : "size-9"}`}
    >
      <svg viewBox="0 0 32 32" className="size-full" fill="none">
        {/* top-knot, like a brush tip */}
        <path
          d="M16 3.5c1.8 1.4 2.2 3.2 1 4.6-.7.8-2.3.8-3 0-1.2-1.4-.4-3.3 2-4.6Z"
          fill="currentColor"
        />
        <g
          className={thinking ? "nook-face-eyes nook-face-eyes--up" : "nook-face-eyes"}
          fill="currentColor"
        >
          <ellipse cx="11.6" cy="15.5" rx="1.5" ry="1.9" />
          <ellipse cx="20.4" cy="15.5" rx="1.5" ry="1.9" />
        </g>
        <circle cx="8.6" cy="19.6" r="1.9" fill="#e86a4f" opacity=".35" />
        <circle cx="23.4" cy="19.6" r="1.9" fill="#e86a4f" opacity=".35" />
        {thinking ? (
          <ellipse cx="16" cy="21" rx="1.4" ry="1.6" stroke="currentColor" strokeWidth="1.5" />
        ) : (
          <path
            d="M12.8 19.8c.9 1.5 2 2.1 3.2 2.1s2.3-.6 3.2-2.1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        )}
      </svg>
    </span>
  );
}
