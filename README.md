# Iron County Tax Sale 2026 — Daily Tracker

## Deploy on Hostinger VPS

### What's in this folder
```
docker-deploy/
├── Dockerfile                         # Builds nginx + your tracker
├── docker-compose.yml                 # Docker Compose config
├── nginx.conf                         # Nginx server config
├── iron_county_daily_tracker.html     # Your app
└── README.md                          # This file
```

### Option A: Hostinger Docker Manager (easiest)

1. Push this folder to a **GitHub repo** (public or private)
2. Go to **hPanel → VPS → Manage → Docker Manager → Projects**
3. Click **Compose** → choose **Compose from URL**
4. Paste the URL to your `docker-compose.yml` on GitHub
5. Click **Deploy**
6. Your app is live at `http://YOUR_VPS_IP`

### Option B: SSH Deploy (manual)

1. SSH into your Hostinger VPS:
   ```bash
   ssh root@YOUR_VPS_IP
   ```

2. Create a directory and upload the files:
   ```bash
   mkdir -p /opt/iron-county-tracker
   cd /opt/iron-county-tracker
   ```

3. Copy all 4 files into that directory (use scp or paste them)

4. Build and run:
   ```bash
   docker compose up -d --build
   ```

5. Your app is live at `http://YOUR_VPS_IP`

### Option C: GitHub Actions (auto-deploy on push)

Add this to `.github/workflows/deploy.yml` in your repo:

```yaml
name: Deploy to Hostinger
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: Deploy to Hostinger
        uses: hostinger/deploy-on-vps@v2
        with:
          api-key: ${{ secrets.HOSTINGER_API_KEY }}
          virtual-machine: ${{ vars.HOSTINGER_VM_ID }}
          project-name: iron-county-tracker
          docker-compose-path: docker-compose.yml
```

Set `HOSTINGER_API_KEY` and `HOSTINGER_VM_ID` in your GitHub repo secrets/variables.

### Adding a domain (optional)

1. In hPanel, point your domain's A record to your VPS IP
2. SSH in and install Certbot for free HTTPS:
   ```bash
   docker compose down
   # Update nginx.conf server_name to your domain
   # Then re-deploy
   docker compose up -d --build
   ```

### Updating the app

Just replace `iron_county_daily_tracker.html` and rebuild:
```bash
docker compose up -d --build
```

### Notes
- localStorage works per-user in their browser — the server just hosts the HTML
- No database needed — all state lives in each user's browser
- The container is ~25MB (nginx:alpine is tiny)
