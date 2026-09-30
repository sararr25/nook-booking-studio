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

function questionPrompt(question: Question) {
  return `${question.label}${question.help ? ` ${question.help}` : ""}`;
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
      text: "Tell me what you'd like to book. I can turn the details into a booking request.",
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
        ? questionPrompt(first)
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
        append(input, "Which service fits best? Choose one below, then I'll ask for the details.");
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
          ? `Please give a size between ${question.min ?? 0} and ${question.max ?? 100} ${question.unit ?? "units"}.`
          : "I couldn't match that to this question. Use one of the choices below, or type its full label.",
      );
      return;
    }
    const nextAnswers = { ...answers, [question.id]: value };
    setAnswers(nextAnswers);
    const following = nextQuestion(service, nextAnswers, skipped);
    append(
      input,
      following
        ? questionPrompt(following)
        : "That's enough to prepare your booking. Review the details next.",
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
          className="nook-enter mt-4 rounded-sm border border-foreground bg-card shadow-[4px_4px_0_var(--brand)]"
        >
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <p className="flex items-center gap-2 font-display text-base font-bold">
              <span
                aria-hidden="true"
                className="size-2.5 border-r-[3px] border-t-[3px] border-brand-ink"
              />
              Plan it together
            </p>
            <p className="font-mono text-xs text-muted-foreground">Draft only, you confirm</p>
          </header>
          <div className="p-4 sm:p-5">
            <div
              className="max-h-80 space-y-4 overflow-y-auto pr-1"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {messages.map((message, index) =>
                message.role === "assistant" ? (
                  <div key={index} className="nook-enter flex max-w-[88%] items-start gap-2.5">
                    <NookFace />
                    <div className="min-w-0">
                      <p className="mb-1 font-mono text-xs font-medium text-brand-ink">Nook</p>
                      <p className="rounded-sm border border-border bg-background px-3.5 py-2.5 text-sm leading-relaxed">
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
                    <p className="mb-1 font-mono text-xs font-medium text-muted-foreground">You</p>
                    <p className="inline-block rounded-sm bg-foreground px-3.5 py-2.5 text-left text-sm leading-relaxed text-card">
                      {message.text}
                    </p>
                  </div>
                ),
              )}
              {thinking && (
                <div className="nook-enter flex items-center gap-2.5" role="status">
                  <NookFace thinking />
                  <span className="sr-only">Nook is typing</span>
                  <span
                    aria-hidden="true"
                    className="nook-dots inline-flex gap-1 rounded-sm border border-border bg-background px-3.5 py-3"
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
                    className="nook-choice min-h-11 rounded-sm border border-border px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
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
                    className="min-h-9 rounded-sm border border-dashed border-input px-2.5 text-xs text-muted-foreground transition-colors hover:border-foreground hover:bg-brand-soft hover:text-foreground disabled:opacity-50"
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
                    className="nook-choice min-h-11 rounded-sm border border-border px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
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
              className="mt-5 flex gap-2 border-t border-border pt-4"
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
                    : "Type your message"
                }
                className="min-h-11 min-w-0 flex-1 rounded-sm border border-input bg-background px-3 text-sm outline-none focus:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              />
              <button
                type="submit"
                disabled={!draft.trim() || busy}
                aria-label="Send message"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-sm bg-foreground text-card transition-colors hover:bg-brand hover:text-brand-foreground disabled:opacity-40 disabled:hover:bg-foreground disabled:hover:text-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
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
              This assistant prepares a draft. You choose a time and confirm the request yourself.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

/** Nook's small face: peach disc, blinking eyes, a smile that turns to an "o" while thinking. */
function NookFace({ thinking = false }: { thinking?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="nook-face mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-foreground bg-brand"
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none">
        <g className="nook-face-eyes" fill="currentColor">
          <circle cx="8.5" cy="10" r="1.6" />
          <circle cx="15.5" cy="10" r="1.6" />
        </g>
        {thinking ? (
          <circle cx="12" cy="16" r="1.7" stroke="currentColor" strokeWidth="1.6" />
        ) : (
          <path
            d="M8 14.5c1 1.6 2.4 2.3 4 2.3s3-.7 4-2.3"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        )}
      </svg>
    </span>
  );
}
