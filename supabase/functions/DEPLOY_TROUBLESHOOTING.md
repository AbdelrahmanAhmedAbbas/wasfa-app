# Edge Functions Deploy – Stuck / No Output

If `supabase functions deploy` hangs with no output, try these in order.

## 1. Run with debug (see where it sticks)

```bash
supabase functions deploy import-create --debug
```

Watch the output; it often hangs during **bundling** or **upload**. Note the last line you see.

## 2. Use alternative bundling (most common fix)

The CLI can hang when bundling locally. Use one of these:

**Option A – Management API (recommended)**  
Bundling happens on Supabase’s side:

```bash
supabase functions deploy import-create --use-api
```

If that works, deploy the rest the same way:

```bash
supabase functions deploy import-share --use-api
supabase functions deploy import-status --use-api
supabase functions deploy import-confirm --use-api
```

**Option B – Docker**  
Only if you have Docker installed:

```bash
supabase functions deploy import-create --use-docker
```

## 3. Check login and project link

```bash
supabase --version
supabase login
supabase link --project-ref axkojyoiodfhvvtsedug
```

Then try deploy again (with `--use-api` if it was sticking).

## 4. Update CLI

```bash
supabase update
```

Then retry deploy (again, try `--use-api` first).

## 5. Verify function syntax (Deno)

Avoid deploy failures due to invalid code:

```bash
cd supabase/functions
deno check ./import-create/index.ts
```

Fix any errors, then redeploy.

---

**Quick one-liner to deploy all with API bundling:**

```bash
for f in import-create import-share import-status import-confirm; do supabase functions deploy $f --use-api; done
```

Or use the script: `./scripts/deploy-functions.sh` (from repo root).
