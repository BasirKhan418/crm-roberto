import { config as loadEnv } from "dotenv";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Job, Worker } from "bullmq";
import heicConvert from "heic-convert";
import { pdf } from "pdf-to-img";
import { createWorker as createTesseractWorker } from "tesseract.js";

import {
  applyDraftExpenseOcrSuggestion,
  getDraftExpenseOcrContext,
  markExpenseOcrStatus,
} from "../db/repository/expense-ocr";
import {
  createBullMqConnection,
  EXPENSE_DRAFT_OCR_QUEUE_NAME,
  type ExpenseDraftOcrJobData,
} from "../lib/expenses/ocr-queue";
import s3 from "../utils/s3/s3Client";

loadEnv({ path: ".env.local" });
loadEnv();

const BUCKET = process.env.AWS_S3_BUCKET || "";
const OCR_LANGUAGES = process.env.EXPENSE_OCR_LANGUAGES || "eng+fra";
const OPENAI_MODEL = process.env.EXPENSE_OCR_MODEL || "gpt-4.1-mini";
const MAX_PDF_PAGES = clampInteger(process.env.EXPENSE_OCR_MAX_PDF_PAGES, 5, 1, 20);
const MAX_OCR_TEXT_CHARS = clampInteger(process.env.EXPENSE_OCR_MAX_TEXT_CHARS, 24_000, 4_000, 80_000);
const OCR_CONCURRENCY = clampInteger(process.env.EXPENSE_OCR_CONCURRENCY, 1, 1, 4);

let sharedOcrWorkerPromise: ReturnType<typeof createTesseractWorker> | null = null;

type AiExtraction = {
  supplierName: string | null;
  supplierRef: string | null;
  categoryName: string | null;
  notes: string | null;
  amountInclVat: number | null;
  amountExclVat: number | null;
  vatAmount: number | null;
  vatRate: number | null;
  expenseDate: string | null;
  dueDate: string | null;
  expenseType: "supplier_expense" | "manual_expense_note" | null;
  confidence: number | null;
};

function clampInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function toCleanString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toDateOrNull(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toMoneyCents(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.round(value * 100));
}

function toVatRate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.round(value * 100) / 100;
  if (normalized < 0 || normalized > 100) {
    return null;
  }

  return normalized;
}

function toConfidence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value < 0 || value > 1) {
    return null;
  }

  return Math.round(value * 1000) / 1000;
}

function normalizeOcrText(text: string) {
  return text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
}

async function getSharedOcrWorker() {
  if (!sharedOcrWorkerPromise) {
    sharedOcrWorkerPromise = createTesseractWorker(OCR_LANGUAGES);
  }

  return sharedOcrWorkerPromise;
}

async function terminateSharedOcrWorker() {
  if (!sharedOcrWorkerPromise) {
    return;
  }

  const worker = await sharedOcrWorkerPromise;
  await worker.terminate();
  sharedOcrWorkerPromise = null;
}

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function downloadAttachmentBuffer(storageKey: string) {
  if (!BUCKET) {
    throw new Error("AWS_S3_BUCKET is not configured");
  }

  const object = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
    })
  );

  if (!object.Body) {
    throw new Error("Attachment body is empty");
  }

  return streamToBuffer(object.Body as NodeJS.ReadableStream);
}

async function normalizeImageBuffer(buffer: Buffer, mimeType: string) {
  if (mimeType !== "image/heic") {
    return {
      buffer,
      mimeType,
    };
  }

  const converted = await heicConvert({
    buffer,
    format: "PNG",
  });

  return {
    buffer: Buffer.from(converted as ArrayBuffer),
    mimeType: "image/png",
  };
}

async function recognizeImageText(buffer: Buffer) {
  const worker = await getSharedOcrWorker();
  const result = await worker.recognize(buffer);
  return normalizeOcrText(result.data.text || "");
}

async function recognizePdfText(buffer: Buffer) {
  const dataUrl = `data:application/pdf;base64,${buffer.toString("base64")}`;
  const document = await pdf(dataUrl, { scale: 3 });

  try {
    const pageCount = Math.min(document.length, MAX_PDF_PAGES);
    const sections: string[] = [];

    for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
      const pageImage = await document.getPage(pageIndex);
      const pageText = await recognizeImageText(Buffer.from(pageImage));
      if (pageText) {
        sections.push(`Page ${pageIndex}\n${pageText}`);
      }
    }

    if (document.length > pageCount) {
      sections.push(`[OCR truncated after ${pageCount} pages out of ${document.length}]`);
    }

    return normalizeOcrText(sections.join("\n\n"));
  } finally {
    document.destroy();
  }
}

async function extractDocumentText(params: { buffer: Buffer; mimeType: string }) {
  if (params.mimeType === "application/pdf") {
    return recognizePdfText(params.buffer);
  }

  const normalizedImage = await normalizeImageBuffer(params.buffer, params.mimeType);
  return recognizeImageText(normalizedImage.buffer);
}

async function extractExpenseFieldsWithAi(params: {
  ocrText: string;
  mimeType: string;
  fileName: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "expense_document_extraction",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              supplierName: { type: ["string", "null"] },
              supplierRef: { type: ["string", "null"] },
              categoryName: { type: ["string", "null"] },
              notes: { type: ["string", "null"] },
              amountInclVat: { type: ["number", "null"] },
              amountExclVat: { type: ["number", "null"] },
              vatAmount: { type: ["number", "null"] },
              vatRate: { type: ["number", "null"] },
              expenseDate: { type: ["string", "null"] },
              dueDate: { type: ["string", "null"] },
              expenseType: {
                type: ["string", "null"],
                enum: ["supplier_expense", "manual_expense_note", null],
              },
              confidence: { type: ["number", "null"] },
            },
            required: [
              "supplierName",
              "supplierRef",
              "categoryName",
              "notes",
              "amountInclVat",
              "amountExclVat",
              "vatAmount",
              "vatRate",
              "expenseDate",
              "dueDate",
              "expenseType",
              "confidence",
            ],
          },
        },
      },
      messages: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text:
                "Extract structured expense data from OCR text. Use only the OCR text provided. Return null for unknown fields. Dates must be ISO 8601 date strings (YYYY-MM-DD). Amounts must be decimal major-unit numbers. expenseType should be supplier_expense for vendor invoices/bills and manual_expense_note for simple receipts or slips.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `File name: ${params.fileName}\nMime type: ${params.mimeType}\n\nOCR text:\n${params.ocrText}`,
            },
          ],
        },
      ],
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: { message?: string };
        choices?: Array<{ message?: { content?: string } }>;
      }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI request failed with status ${response.status}`);
  }

  const rawContent = payload?.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error("OpenAI response did not include structured content");
  }

  return JSON.parse(rawContent) as AiExtraction;
}

function buildNormalizedSuggestion(aiExtraction: AiExtraction, ocrText: string) {
  const amountInclVatCents = toMoneyCents(aiExtraction.amountInclVat);
  const amountExclVatFromAi = toMoneyCents(aiExtraction.amountExclVat);
  const vatAmountCents = toMoneyCents(aiExtraction.vatAmount);
  let vatRate = toVatRate(aiExtraction.vatRate);
  let amountExclVatCents = amountExclVatFromAi;

  if (amountExclVatCents === null && amountInclVatCents !== null && vatAmountCents !== null) {
    amountExclVatCents = Math.max(0, amountInclVatCents - vatAmountCents);
  }

  if (amountExclVatCents === null && amountInclVatCents !== null && vatRate !== null) {
    amountExclVatCents = Math.max(0, Math.round(amountInclVatCents / (1 + vatRate / 100)));
  }

  if (amountExclVatCents === null && amountInclVatCents !== null) {
    amountExclVatCents = amountInclVatCents;
    vatRate = vatRate ?? 0;
  }

  if (vatRate === null && amountInclVatCents !== null && amountExclVatCents !== null && amountExclVatCents > 0) {
    vatRate = Math.max(0, Math.round((((amountInclVatCents - amountExclVatCents) / amountExclVatCents) * 100) * 100) / 100);
  }

  const notes = toCleanString(aiExtraction.notes)
    || toCleanString(aiExtraction.supplierName)
    || null;

  return {
    amountExclVatCents,
    vatRate,
    expenseDate: toDateOrNull(aiExtraction.expenseDate),
    dueDate: toDateOrNull(aiExtraction.dueDate),
    supplierRef: toCleanString(aiExtraction.supplierRef),
    notes,
    supplierName: toCleanString(aiExtraction.supplierName),
    categoryName: toCleanString(aiExtraction.categoryName),
    expenseType: aiExtraction.expenseType,
    confidence: toConfidence(aiExtraction.confidence),
    extractedText: ocrText,
    extraction: aiExtraction as unknown as Record<string, unknown>,
  };
}

async function processExpenseDraftOcr(job: Job<ExpenseDraftOcrJobData>) {
  const contextResult = await getDraftExpenseOcrContext(job.data);
  if (!contextResult.success) {
    throw new Error(contextResult.message);
  }

  const { expense, attachment } = contextResult.data;
  if (expense.status !== "draft") {
    return { skipped: true, reason: "Expense is no longer a draft" };
  }

  await markExpenseOcrStatus({
    companyId: job.data.companyId,
    expenseId: job.data.expenseId,
    status: "processing",
  });

  const storageKey = toCleanString(attachment.storageKey);
  const mimeType = toCleanString(attachment.mimeType);
  const fileName = toCleanString(attachment.originalName) || toCleanString(attachment.displayName) || "expense-document";

  if (!storageKey || !mimeType) {
    throw new Error("Attachment metadata is incomplete for OCR processing");
  }

  const attachmentBuffer = await downloadAttachmentBuffer(storageKey);
  const extractedText = await extractDocumentText({
    buffer: attachmentBuffer,
    mimeType,
  });

  if (!extractedText) {
    throw new Error("OCR did not extract any text from the expense attachment");
  }

  const aiExtraction = await extractExpenseFieldsWithAi({
    ocrText: extractedText.slice(0, MAX_OCR_TEXT_CHARS),
    mimeType,
    fileName,
  });

  const applyResult = await applyDraftExpenseOcrSuggestion({
    companyId: job.data.companyId,
    expenseId: job.data.expenseId,
    updatedBy: job.data.createdBy,
    suggestion: buildNormalizedSuggestion(aiExtraction, extractedText),
  });

  if (!applyResult.success) {
    throw new Error(applyResult.message);
  }

  return {
    expenseId: job.data.expenseId,
    applied: true,
  };
}

async function updateRetryState(job: Job<ExpenseDraftOcrJobData>, error: Error) {
  const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 1);

  await markExpenseOcrStatus({
    companyId: job.data.companyId,
    expenseId: job.data.expenseId,
    status: isFinalAttempt ? "failed" : "queued",
    error: error.message,
  });
}

async function main() {
  if (!BUCKET) {
    throw new Error("AWS_S3_BUCKET is not configured");
  }

  const worker = new Worker<ExpenseDraftOcrJobData>(
    EXPENSE_DRAFT_OCR_QUEUE_NAME,
    async (job) => {
      try {
        return await processExpenseDraftOcr(job);
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        await updateRetryState(job, normalizedError);
        throw normalizedError;
      }
    },
    {
      connection: createBullMqConnection(),
      concurrency: OCR_CONCURRENCY,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[expense-ocr] completed ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[expense-ocr] failed ${job?.id || "unknown"}: ${error.message}`);
  });

  const shutdown = async () => {
    await worker.close();
    await terminateSharedOcrWorker();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });

  console.log(`[expense-ocr] worker started on queue ${EXPENSE_DRAFT_OCR_QUEUE_NAME}`);
}

void main().catch(async (error) => {
  console.error("[expense-ocr] worker boot failed", error);
  await terminateSharedOcrWorker();
  process.exit(1);
});