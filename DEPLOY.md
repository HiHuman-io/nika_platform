# Deploy — app.musichub.hihuman.io

Careful, isolated deploy. Nothing here touches other apps on the VPS:
- Unique container (`nika-catalog`) + network (`nika-catalog-net`).
- Bound to `127.0.0.1:3400` only (not public); nginx fronts it.
- A brand-new nginx vhost, symlinked (not copied).
- `certbot certonly` only **issues** a cert — it does not rewrite other vhosts.

**Facts:** domain `app.musichub.hihuman.io` · VPS `81.17.96.61` · host port `3400` → container `3000`.

Prereqs on the VPS: Docker + Docker Compose, nginx, certbot (`python3-certbot-nginx`).

---

## 1. DNS (EuroDNS)
In the `hihuman.io` zone, add an **A record**:

| Host | Type | Value |
|------|------|-------|
| `app.musichub` | A | `81.17.96.61` |

Wait for it to resolve before certbot:
```bash
dig +short app.musichub.hihuman.io      # must print 81.17.96.61
```

## 2. Get the code + env on the VPS
```bash
sudo mkdir -p /opt/nika-catalog && cd /opt/nika-catalog
git clone git@github.com:HiHuman-io/nika_platform.git .   # or: git pull
cp .env.example .env
nano .env    # fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, N8N_IMPORT_WEBHOOK_URL
```

## 3. Build + start the container
Disk is tight (~88%) — check first, and only prune *safe* things (never `docker system prune -a`, which could remove other apps' images):
```bash
df -h /                      # confirm headroom
ss -tlnp | grep 3400 || true # confirm 3400 is free
docker compose up -d --build
docker image prune -f        # reclaim dangling layers only (safe)
```
Verify the app is up on localhost:
```bash
curl -I http://127.0.0.1:3400   # expect HTTP/1.1 200 or 307
docker logs --tail=50 nika-catalog
```

## 4. TLS certificate (issue only — doesn't touch other vhosts)
```bash
sudo certbot certonly --nginx -d app.musichub.hihuman.io
# creates /etc/letsencrypt/live/app.musichub.hihuman.io/{fullchain,privkey}.pem
```

## 5. Enable the nginx vhost (symlink, not copy) + reload
```bash
sudo ln -s /opt/nika-catalog/deploy/nginx/app.musichub.hihuman.io.conf \
           /etc/nginx/sites-enabled/app.musichub.hihuman.io.conf
sudo nginx -t                 # MUST pass before reloading
sudo systemctl reload nginx   # graceful — other sites unaffected
```
Then open **https://app.musichub.hihuman.io** and log in.

## 6. Supabase auth
Add the domain in **Supabase → Authentication → URL Configuration** (Site URL + Redirect URLs):
`https://app.musichub.hihuman.io`

---

## Updating later
```bash
cd /opt/nika-catalog && git pull
docker compose up -d --build && docker image prune -f
```
(Config changes to `next.config.ts` — e.g. the allowed origin — take effect on rebuild. The nginx vhost is a symlink into the repo, so `git pull` updates it; run `sudo nginx -t && sudo systemctl reload nginx` if it changed.)

## Rollback / stop (safe, isolated)
```bash
docker compose down                      # stops only this app
sudo rm /etc/nginx/sites-enabled/app.musichub.hihuman.io.conf
sudo nginx -t && sudo systemctl reload nginx
```

## Notes
- `NEXT_PUBLIC_*` are baked into the client bundle at **build** time, so a value change requires `--build`.
- Cert auto-renews via certbot's systemd timer; the `.well-known/acme-challenge` location in the vhost keeps HTTP renewals working.
