import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, FileText, Link2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { BusinessConfig } from "@/lib/nook/types";
import { readPublicGoogleSheet } from "@/lib/nook/pricing-import.functions";

type PriceRow = {
  id: string;
  name: string;
  kind: "service" | "option";
  serviceId: string;
  questionId: string;
  optionId: string;
  price: number;
  duration: number;
};

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

const number = (value: unknown) => {
  const raw = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .trim();
  if (!raw) return 0;
  const decimal = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? "," : ".";
  const thousands = decimal === "," ? "." : ",";
  return Number(raw.replaceAll(thousands, "").replace(decimal, "."));
};
const requiredPrice = (value: unknown, row: number) => {
  const raw = String(value ?? "").trim();
  if (!/\d/.test(raw)) throw new Error(`Row ${row}: add a numeric price before importing.`);
  const parsed = number(raw);
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new Error(`Row ${row}: enter a valid positive price.`);
  return parsed;
};
const optionalDuration = (value: unknown, row: number) => {
  if (String(value ?? "").trim() === "") return 0;
  const parsed = number(value);
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new Error(`Row ${row}: enter a valid duration in minutes.`);
  return parsed;
};
const normalized = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

function rowsFromTable(table: unknown[][], business: BusinessConfig): PriceRow[] {
  const [first, ...body] = table;
  if (!first) return [];
  const headers = first.map(normalized);
  const column = (names: string[]) =>
    headers.findIndex((header) => names.some((name) => header.includes(name)));
  const serviceCol = column(["service", "treatment", "servizio"]);
  const nameCol = column(["name", "item", "design", "nome"]);
  const questionCol = column(["question", "category", "domanda"]);
  const optionCol = column(["option", "answer", "choice", "risposta"]);
  const priceCol = column(["price", "amount", "cost", "prezzo"]);
  const durationCol = column(["duration", "minutes", "time", "minuti"]);
  if (priceCol < 0 || (serviceCol < 0 && nameCol < 0))
    throw new Error(
      "Add at least Service and Price columns. Optional: Duration, Question, Option.",
    );
  return body
    .slice(0, 100)
    .map((cells, index) => {
      const serviceName = String(cells[serviceCol] ?? cells[nameCol] ?? "").trim();
      const questionName = String(cells[questionCol] ?? "").trim();
      const optionName = String(cells[optionCol] ?? "").trim();
      const service = business.services.find(
        (item) => normalized(item.name) === normalized(serviceName),
      );
      const question = service?.questions.find(
        (item) => normalized(item.label) === normalized(questionName),
      );
      const option = question?.options?.find(
        (item) => normalized(item.label) === normalized(optionName),
      );
      return {
        id: crypto.randomUUID(),
        name: optionName || serviceName,
        kind: questionName || optionName ? ("option" as const) : ("service" as const),
        serviceId: service?.id ?? "new",
        questionId: question?.id ?? "",
        optionId: option?.id ?? "",
        price: requiredPrice(cells[priceCol], index + 2),
        duration: optionalDuration(cells[durationCol], index + 2),
      };
    })
    .filter((row) => row.name);
}

async function rowsFromPdf(file: File, business: BusinessConfig): Promise<PriceRow[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
    .promise;
  const lines: string[] = [];
  for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, 20); pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    let line = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += `${item.str} `;
      if ("hasEOL" in item && item.hasEOL) {
        lines.push(line.trim());
        line = "";
      }
    }
    if (line.trim()) lines.push(line.trim());
  }
  if (!lines.length)
    throw new Error(
      "No selectable text found in this PDF. Export a spreadsheet or use a text PDF.",
    );
  return lines
    .flatMap((line) => {
      const match = line.match(
        /^(.{3,80}?)\s+[€$£]?\s*(\d+(?:[,.]\d{1,2})?)(?:\s*[€$£])?(?:\s*[-–]\s*[€$£]?\s*\d+(?:[,.]\d{1,2})?)?(?:\s*[,·|]\s*|\s+)?(?:(\d+(?:\.\d+)?)\s*(min|minutes|hr|hours))?/i,
      );
      if (!match?.[1] || !match[2]) return [];
      const name = match[1].trim();
      const service = business.services.find((item) => normalized(item.name) === normalized(name));
      return [
        {
          id: crypto.randomUUID(),
          name,
          kind: "service" as const,
          serviceId: service?.id ?? "new",
          questionId: "",
          optionId: "",
          price: number(match[2]),
          duration: match[3]
            ? number(match[3]) * (/^(hr|hours)$/i.test(match[4] ?? "") ? 60 : 1)
            : 0,
        },
      ];
    })
    .slice(0, 100);
}

export function PricingImport({
  business,
  updateBusiness,
}: {
  business: BusinessConfig;
  updateBusiness: (updater: (draft: BusinessConfig) => BusinessConfig) => void;
}) {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [sheetUrl, setSheetUrl] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const fetchSheet = useServerFn(readPublicGoogleSheet);
  const patch = (id: string, changes: Partial<PriceRow>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...changes } : row)));
  const fileImport = async (file?: File) => {
    if (!file) return;
    if (file.size > 5_000_000) {
      toast.error("Use a file under 5 MB.");
      return;
    }
    setLoading(true);
    try {
      let parsed: PriceRow[];
      if (/\.pdf$/i.test(file.name)) parsed = await rowsFromPdf(file, business);
      else if (/\.xlsx$/i.test(file.name)) {
        const readXlsxFile = (await import("read-excel-file/browser")).default;
        parsed = rowsFromTable((await readXlsxFile(file))[0]?.data ?? [], business);
      } else parsed = rowsFromTable(parseCsv(await file.text()), business);
      if (!parsed.length)
        throw new Error("No price rows found. Check the file columns or PDF text.");
      setRows(parsed);
      setSource(file.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read this file");
    } finally {
      setLoading(false);
    }
  };
  const sheetImport = async () => {
    setLoading(true);
    try {
      const { csv } = await fetchSheet({ data: { url: sheetUrl } });
      const parsed = rowsFromTable(parseCsv(csv), business);
      if (!parsed.length) throw new Error("No price rows found in this Sheet.");
      setRows(parsed);
      setSource("Google Sheet");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read this Sheet");
    } finally {
      setLoading(false);
    }
  };
  const valid =
    rows.length > 0 &&
    rows.every(
      (row) =>
        row.price >= 0 &&
        row.duration >= 0 &&
        (row.kind === "service" ||
          Boolean(row.serviceId !== "new" && row.questionId && row.optionId)),
    );
  const apply = () => {
    if (!valid) return;
    updateBusiness((current) => {
      const services = current.services.map((service) => ({
        ...service,
        questions: service.questions.map((question) => ({
          ...question,
          ...(question.options
            ? { options: question.options.map((option) => ({ ...option })) }
            : {}),
        })),
      }));
      for (const row of rows) {
        if (row.kind === "service") {
          const found = services.find(
            (service) =>
              service.id === row.serviceId ||
              (row.serviceId === "new" && normalized(service.name) === normalized(row.name)),
          );
          if (found) {
            found.basePrice = row.price;
            if (row.duration > 0) found.baseDuration = row.duration;
          } else
            services.push({
              id: `service-${crypto.randomUUID().slice(0, 8)}`,
              name: row.name,
              blurb: "",
              basePrice: row.price,
              baseDuration: row.duration || 60,
              depositPercent: 20,
              questions: [],
            });
        } else {
          const option = services
            .find((service) => service.id === row.serviceId)
            ?.questions.find((question) => question.id === row.questionId)
            ?.options?.find((item) => item.id === row.optionId);
          if (option) {
            option.priceDelta = row.price;
            if (row.duration > 0) option.durationDelta = row.duration;
          }
        }
      }
      return { ...current, services };
    });
    setRows([]);
    toast.success("Price changes added. Check the save status above before leaving.");
  };
  return (
    <section className="border border-border bg-background p-5">
      <div className="flex items-start gap-3">
        <FileSpreadsheet className="mt-1 size-5 text-brand" />
        <div>
          <h2 className="font-display text-xl font-semibold">Import an existing price list</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload XLSX, CSV or a text PDF, or paste a publicly readable Google Sheet. Review every
            row before applying it.
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-border px-4 text-sm">
          <Upload className="size-4" /> Upload file
          <input
            type="file"
            accept=".xlsx,.csv,.pdf"
            className="sr-only"
            onChange={(event) => void fileImport(event.target.files?.[0])}
          />
        </label>
        <div className="min-w-[17rem] flex-1">
          <label htmlFor="sheet-url" className="mb-1 block text-xs font-medium">
            Google Sheet URL
          </label>
          <input
            id="sheet-url"
            value={sheetUrl}
            onChange={(event) => setSheetUrl(event.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            className="min-h-11 w-full border border-border bg-card px-3 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={!sheetUrl || loading}
          onClick={() => void sheetImport()}
          className="inline-flex min-h-11 items-center gap-2 bg-ink px-4 text-sm text-brand-foreground disabled:opacity-50"
        >
          <Link2 className="size-4" /> Read Sheet
        </button>
      </div>
      {loading && (
        <p role="status" className="mt-4 text-sm">
          Reading price list…
        </p>
      )}
      {rows.length > 0 && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">
              Review {rows.length} rows from {source}
            </h3>
            <button type="button" onClick={() => setRows([])} className="text-sm underline">
              Discard import
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Service rows set base prices. Answer rows set flat changes on existing choices. PDF
            extraction may need corrections.
          </p>
          <div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto">
            {rows.map((row) => {
              const service = business.services.find((item) => item.id === row.serviceId);
              const question = service?.questions.find((item) => item.id === row.questionId);
              return (
                <div
                  key={row.id}
                  className="grid gap-2 border border-border bg-card p-3 sm:grid-cols-[minmax(8rem,1fr)_8rem_8rem_7rem_7rem]"
                >
                  <input
                    aria-label="Imported item name"
                    value={row.name}
                    onChange={(event) => patch(row.id, { name: event.target.value })}
                    className="min-h-10 min-w-0 border border-border px-2 text-sm"
                  />
                  <select
                    aria-label="Price row type"
                    value={row.kind}
                    onChange={(event) =>
                      patch(row.id, { kind: event.target.value as PriceRow["kind"] })
                    }
                    className="min-h-10 border border-border bg-card px-2 text-sm"
                  >
                    <option value="service">Base service</option>
                    <option value="option">Answer change</option>
                  </select>
                  <select
                    aria-label="Matching service"
                    value={row.serviceId}
                    onChange={(event) =>
                      patch(row.id, { serviceId: event.target.value, questionId: "", optionId: "" })
                    }
                    className="min-h-10 border border-border bg-card px-2 text-sm"
                  >
                    <option value="new">New service</option>
                    {business.services.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Price amount"
                    type="number"
                    min="0"
                    value={row.price}
                    onChange={(event) => patch(row.id, { price: Number(event.target.value) })}
                    className="min-h-10 min-w-0 border border-border px-2 text-sm"
                  />
                  <input
                    aria-label="Minutes"
                    type="number"
                    min="0"
                    value={row.duration}
                    onChange={(event) => patch(row.id, { duration: Number(event.target.value) })}
                    className="min-h-10 min-w-0 border border-border px-2 text-sm"
                  />
                  {row.kind === "option" && (
                    <div className="flex gap-2 sm:col-span-5">
                      <select
                        aria-label="Matching question"
                        value={row.questionId}
                        onChange={(event) =>
                          patch(row.id, { questionId: event.target.value, optionId: "" })
                        }
                        className="min-h-10 min-w-0 flex-1 border border-border bg-card px-2 text-sm"
                      >
                        <option value="">Choose question</option>
                        {service?.questions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Matching answer"
                        value={row.optionId}
                        onChange={(event) => patch(row.id, { optionId: event.target.value })}
                        className="min-h-10 min-w-0 flex-1 border border-border bg-card px-2 text-sm"
                      >
                        <option value="">Choose answer</option>
                        {question?.options?.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!valid}
            onClick={apply}
            className="mt-5 inline-flex min-h-11 items-center gap-2 bg-ink px-5 text-sm font-medium text-brand-foreground disabled:opacity-50"
          >
            <FileText className="size-4" /> Apply reviewed prices
          </button>
        </div>
      )}
    </section>
  );
}
