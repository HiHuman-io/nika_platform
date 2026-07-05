# Nika Catalog — VPS Deployment Runbook

Deploy the app to **https://app.musichub.hihuman.io** on the Contabo VPS.

| Fact | Value |
|------|-------|
| Domain | `app.musichub.hihuman.io` |
| VPS IP | `81.17.96.61` |
| Host port → container | `127.0.0.1:3400` → `3000` |
| Container / network | `nika-catalog` / `nika-catalog-net` |
| App dir on VPS | `/opt/nika-catalog` |
| Repo | `git@github.com:HiHuman-io/nika_platform.git` (private) |

### Safety (shared VPS — other apps live here: n8n, imob, klc, bluecrow, chatbots, vsm)
- App is bound to **localhost only** (`127.0.0.1:3400`) — never publicly exposed; nginx fronts it.
- Unique container + network names — no clashes.
- A **new** nginx vhost, **symlinked** (not copied) — existing sites untouched.
- `certbot certonly` only **issues** a cert — it does not rewrite other vhosts.
- **NEVER run** `docker system prune -a` or `docker image prune -a` (would delete other apps' images). Only `docker image prune -f` (dangling) / `docker builder prune -f`.

---

## Step 1 — DNS record (EuroDNS)

You're in the EuroDNS **Domains** list showing `hihuman.io`.

1. Click the domain **`hihuman.io`** (or the **pencil/edit** icon on its row).
2. Open the **DNS** section (EuroDNS labels it **"DNS"** / **"Advanced DNS"** / **"DNS Zone / Records"** — look in the domain's left menu or tabs).
3. Click **Add record** (or **"+ New record"**) and enter exactly:
   - **Type:** `A`
   - **Host / Name:** `app.musichub`   *(just this — EuroDNS appends `.hihuman.io`)*
   - **IP address / Target / Points to:** `81.17.96.61`
   - **TTL:** `300` (or leave default)
4. **Save / Confirm**.

Then verify it resolves (run on the VPS, may take 1–15 min):
```bash
dig +short app.musichub.hihuman.io      # must print 81.17.96.61
```
Do not run certbot (Step 5) until this prints the IP.

---

## Step 2 — GitHub deploy key (VPS read access to the private repo)

On the VPS:
```bash
ssh-keygen -t ed25519 -C "vps-nika-deploy" -f ~/.ssh/nika_deploy -N ""
cat ~/.ssh/nika_deploy.pub
```
Copy the printed key → **GitHub → repo `nika_platform` → Settings → Deploy keys → Add deploy key**
(Title: `contabo-vps`; paste the key; **leave "Allow write access" UNCHECKED**; Add key).

Set up an SSH alias so future `git pull` uses this key, and test:
```bash
printf '\nHost github-nika\n  HostName github.com\n  User git\n  IdentityFile ~/.ssh/nika_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
ssh -T git@github-nika      # expect: "Hi HiHuman-io/nika_platform! You've successfully authenticated"
```

---

## Step 3 — Clone + configure env

```bash
sudo mkdir -p /opt/nika-catalog && sudo chown $USER:$USER /opt/nika-catalog
git clone git@github-nika:HiHuman-io/nika_platform.git /opt/nika-catalog
cd /opt/nika-catalog
cp .env.example .env
nano .env
```
Fill in the three values (copy the Supabase ones from your **local** machine's `.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
N8N_IMPORT_WEBHOOK_URL=https://n8n.hihuman.io/webhook/nika-import
```
Save (Ctrl+O, Enter) and exit (Ctrl+X).

---

## Step 4 — Build + run + verify (localhost)

```bash
cd /opt/nika-catalog
docker compose up -d --build     # first build takes a few minutes
docker image prune -f            # reclaim dangling layers only (safe)
docker compose ps                # nika-catalog should be "running"
curl -I http://127.0.0.1:3400    # expect HTTP/1.1 200 or 307
docker logs --tail=50 nika-catalog
```
If `curl` returns 200/307, the app is healthy. **Do not proceed to nginx if this fails** — check `docker logs` first.

---

## Step 5 — TLS certificate (only after DNS resolves)

```bash
dig +short app.musichub.hihuman.io          # confirm it prints 81.17.96.61 FIRST
sudo certbot certonly --nginx -d app.musichub.hihuman.io
```
This creates `/etc/letsencrypt/live/app.musichub.hihuman.io/{fullchain,privkey}.pem`.

---

## Step 6 — Enable the nginx vhost (symlink) + reload

```bash
sudo ln -s /opt/nika-catalog/deploy/nginx/app.musichub.hihuman.io.conf \
           /etc/nginx/sites-enabled/app.musichub.hihuman.io.conf
sudo nginx -t                    # MUST say "syntax is ok" / "test is successful"
sudo systemctl reload nginx      # graceful — other sites unaffected
```

---

## Step 7 — Supabase auth URL

In **Supabase → Authentication → URL Configuration**, add to Site URL / Redirect URLs:
```
https://app.musichub.hihuman.io
```

---

## Step 8 — Final check

Open **https://app.musichub.hihuman.io** → log in → confirm Catalog/Raw Entries/Import/Settings load, and test a manual file upload (the Manual Import n8n workflow must be **Active**).

---

## Updating later
```bash
cd /opt/nika-catalog && git pull
docker compose up -d --build && docker image prune -f
# if the nginx vhost changed: sudo nginx -t && sudo systemctl reload nginx
```
> `NEXT_PUBLIC_*` are baked into the client bundle at **build** time, so changing them needs `--build`.

## Rollback / stop (isolated, safe)
```bash
docker compose down
sudo rm /etc/nginx/sites-enabled/app.musichub.hihuman.io.conf
sudo nginx -t && sudo systemctl reload nginx
```

## Troubleshooting
- **`curl 127.0.0.1:3400` fails** → `docker logs nika-catalog`; check `.env` values are set.
- **`nginx -t` fails on cert paths** → certbot (Step 5) didn't run or DNS wasn't resolving; re-run Step 5.
- **Login/session issues** → confirm Step 7 (Supabase URL) and that you're on `https://`.
- **Uploads rejected** → the domain must match `allowedOrigins` in `next.config.ts` (it does: `app.musichub.hihuman.io`) and n8n import workflow must be Active.
- **Disk full mid-build** → `df -h /`; `docker image prune -f` and `docker builder prune -f` only. Never `-a`.
