import { Queue } from "bullmq";
import IORedis from "ioredis";

export const EXPENSE_DRAFT_OCR_QUEUE_NAME = "expense-draft-ocr";

export type ExpenseDraftOcrJobData = {
  companyId: string;
  expenseId: string;
  attachmentId: string;
  createdBy: string;
};

let queueConnection: IORedis | null = null;
let expenseDraftOcrQueue: Queue<ExpenseDraftOcrJobData> | null = null;

function getValkeyUrl() {
  const valkeyUrl = process.env.VALKEY_URL?.trim();

  if (!valkeyUrl) {
    throw new Error("VALKEY_URL is not configured");
  }

  return valkeyUrl;
}

export function createBullMqConnection() {
  return new IORedis(getValkeyUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

function getQueueConnection() {
  if (!queueConnection) {
    queueConnection = createBullMqConnection();
  }

  return queueConnection;
}

export function getExpenseDraftOcrQueue() {
  if (!expenseDraftOcrQueue) {
    expenseDraftOcrQueue = new Queue<ExpenseDraftOcrJobData>(EXPENSE_DRAFT_OCR_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5_000,
        },
        removeOnComplete: {
          age: 60 * 60 * 24,
          count: 1_000,
        },
        removeOnFail: {
          age: 60 * 60 * 24 * 7,
          count: 1_000,
        },
      },
    });
  }

  return expenseDraftOcrQueue;
}

export async function enqueueExpenseDraftOcrJob(data: ExpenseDraftOcrJobData) {
  const queue = getExpenseDraftOcrQueue();

  return queue.add("process-expense-draft-ocr", data, {
    jobId: data.expenseId,
  });
}