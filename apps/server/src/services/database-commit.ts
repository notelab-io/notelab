import type { SQL } from "drizzle-orm";

import { db } from "../db";
import type { Database } from "../db";
import {
  type DatabaseChangedArea,
  type DatabaseDelta,
  type DatabaseMutationResponse,
  toMutationResponse,
} from "./database-delta";

export class DatabaseMutationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "DatabaseMutationError";
  }
}

export type SqlExecutor = {
  execute: (query: SQL) => Promise<unknown>;
};

type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

type CommitOptions = {
  actorId: string;
  changed: DatabaseChangedArea[];
  databaseId: string;
};

type CommitMetadata = {
  actorId: string;
  changed: DatabaseChangedArea[];
  committedAt: string;
  databaseId: string;
  mutationId: string;
};

export type DatabaseMutationCommitResult = CommitMetadata & {
  delta: DatabaseDelta;
};

type CommitSuccess = {
  ok: true;
} & DatabaseMutationCommitResult;

export async function commitDatabaseMutation(
  options: CommitOptions,
  mutate: (tx: DatabaseTransaction) => Promise<{ delta: DatabaseDelta }>,
): Promise<DatabaseMutationCommitResult> {
  const mutationId = crypto.randomUUID();
  const committedAt = new Date().toISOString();

  try {
    const { delta } = await db.transaction(mutate);

    return {
      actorId: options.actorId,
      changed: options.changed,
      committedAt,
      databaseId: options.databaseId,
      delta,
      mutationId,
    };
  } catch (error) {
    if (error instanceof DatabaseMutationError) {
      throw error;
    }

    throw error;
  }
}

export function mutationResponse(
  mutation: CommitSuccess,
): DatabaseMutationResponse {
  return toMutationResponse(
    {
      actorId: mutation.actorId,
      changed: mutation.changed,
      committedAt: mutation.committedAt,
      databaseId: mutation.databaseId,
      mutationId: mutation.mutationId,
    },
    mutation.delta,
  );
}