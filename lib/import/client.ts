import { api } from "@/convex/_generated/api";
import { convex, getServerError } from "@/lib/convex/client";

import { ImportRequestError } from "./errors";
import type { ImportCreateInput, ImportCreateResponse, ImportStatusResponse } from "./types";

/** Starts an import and turns a server rejection into an error that carries its code. */
async function startImport(input: ImportCreateInput): Promise<ImportCreateResponse> {
  try {
    const created = await convex.action(api.imports.create, {
      sourceUrl: input.source_url,
      sharedText: input.shared_text,
      entrypoint: input.entrypoint,
    });
    return created as ImportCreateResponse;
  } catch (error) {
    const rejected = getServerError(error);
    if (rejected) throw new ImportRequestError(rejected.message, rejected.code);
    throw error;
  }
}

export async function createImportJob(input: ImportCreateInput): Promise<ImportCreateResponse> {
  return startImport({ ...input, entrypoint: input.entrypoint ?? "paste_url" });
}

export async function createShareImport(input: {
  source_url?: string;
  shared_text?: string;
}): Promise<ImportCreateResponse> {
  return startImport({ ...input, entrypoint: "share_intent" });
}

export async function getImportJob(jobId: string): Promise<ImportStatusResponse> {
  const response = await convex.query(api.imports.get, { jobId });
  if (!response) throw new ImportRequestError("Import not found.");
  return response;
}
