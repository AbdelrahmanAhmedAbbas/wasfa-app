import { handleImportCreate } from "../_shared/create-handler.ts";

Deno.serve((req) => handleImportCreate(req, "paste_url"));
