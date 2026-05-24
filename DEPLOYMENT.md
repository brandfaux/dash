# Deployment Guide — LearnEngine

This guide shows how to deploy LearnEngine to production on various platforms.

---

## 📋 Deployment Checklist

Before deploying, ensure:

- [ ] All CSS files are complete (`base.css`, `components.css`, `pages.css`, `analytics.css`, `flashcards.css`)
- [ ] No console errors or warnings (test in Chrome DevTools)
- [ ] All features tested on mobile (width 320px - 768px - 1024px)
- [ ] `README.md`, `LICENSE`, and `CONTRIBUTING.md` are in place
- [ ] Platform config (`src/config/platform.js`) is customized for your use case
- [ ] Git repository is clean (no uncommitted changes)

---

## 🚀 Option 1: GitHub Pages (Free, Easiest)

Perfect for hosting directly from GitHub with a custom domain or GitHub Pages domain.

### Steps:

1. **Ensure your repo is public:**
   ```bash
   git remote -v  # Should show github.com/your-username/dash
   ```

2. **In GitHub, go to Settings → Pages:**
   - Source: `Deploy from a branch`
   - Branch: `main` (or your default)
   - Folder: `/ (root)`
   - Save

3. **Wait ~1-2 minutes for GitHub to build:**
   - Site will be available at: `https://your-username.github.io/dash`

4. **(Optional) Add a custom domain:**
   - In Settings → Pages → Custom domain
   - Enter your domain (e.g., `learnengine.com`)
   - Update your domain DNS records to point to GitHub Pages IPs (see GitHub docs)

### Pros:
- Free, simple, automatic updates on push
- GitHub CDN for fast delivery

### Cons:
- GitHub-dependent, rate limits on API calls
- Requires public repository

---

## 🚀 Option 2: Vercel (Free, Fast)

Vercel is optimized for static sites with one-click deployments from GitHub.

### Steps:

1. **Sign up at [vercel.com](https://vercel.com)**

2. **Connect your GitHub repo:**
   - Click "New Project" → "Import Git Repository"
   - Select your `dash` repo
   - Click "Import"

3. **Vercel auto-configures:**
   - Framework: "Other" (already detected)
   - Build command: (leave empty—static files)
   - Output directory: `/` (root)
   - Install command: (leave empty)

4. **Deploy:**
   - Vercel automatically deploys on every push to `main`
   - Site available at: `https://dash-[random].vercel.app`

5. **(Optional) Custom domain:**
   - In project Settings → Domains
   - Add your domain
   - Update DNS records

### Pros:
- Free tier, very fast CDN, auto-scaling
- One-click GitHub integration
- Free SSL certificates
- Environment variables support
- Analytics included

### Cons:
- Vercel account required
- Custom domains on hobby tier available but some premium features require paid plan

---

## 🚀 Option 3: Netlify (Free, User-Friendly)

Simple drag-and-drop or Git integration.

### Steps (Git method):

1. **Sign up at [netlify.com](https://netlify.com)**

2. **Connect GitHub:**
   - Click "New site from Git"
   - Authorize Netlify to access GitHub
   - Select `dash` repo

3. **Configure build:**
   - Build command: (leave empty)
   - Publish directory: `/`

4. **Deploy:**
   - Netlify automatically builds on push
   - Site available at: `https://[random].netlify.app`

### Steps (Drag-and-drop):

1. **Zip the entire `dash/` folder:**
   ```bash
   zip -r dash.zip dash/
   ```

2. **On Netlify, drag-and-drop `dash/` folder**

3. **Done** — Site goes live instantly

### Pros:
- Extremely user-friendly
- Free tier is generous (unlimited static sites)
- Drag-and-drop or Git integration
- Built-in form handling, functions
- Good analytics

### Cons:
- Netlify account required
- Slightly slower cold starts than Vercel

---

## 🚀 Option 4: Railway (Paid, Simple)

Static hosting with minimal config.

### Steps:

1. **Sign up at [railway.app](https://railway.app)**

2. **Connect GitHub:**
   - New Project → Import from GitHub
   - Select `dash` repo

3. **Railway auto-detects static site:**
   - No build config needed
   - Deploy on push

4. **Custom domain:**
   - Project Settings → Domains

### Pricing:
- $5/month starter (includes static hosting)
- Free tier available with limits

---

## 🚀 Option 5: Self-Hosted (Any VPS)

For ultimate control, deploy to your own server.

### Prerequisites:
- VPS or dedicated server (Linode, DigitalOcean, Hetzner, AWS, etc.)
- SSH access
- Basic Linux knowledge
- Domain name (optional)

### Simple setup with Nginx:

1. **SSH into your server:**
   ```bash
   ssh root@your-server-ip
   ```

2. **Install Nginx:**
   ```bash
   apt update && apt install -y nginx
   ```

3. **Clone your repo:**
   ```bash
   cd /var/www
   git clone https://github.com/your-username/dash.git
   cd dash
   ```

4. **Create Nginx config:**
   ```bash
   cat > /etc/nginx/sites-available/dash << 'EOF'
   server {
       listen 80;
       server_name your-domain.com www.your-domain.com;

       root /var/www/dash;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       # Cache static assets for 1 year
       location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
           expires 1y;
           add_header Cache-Control "public, immutable";
       }

       # Disable caching for HTML
       location ~* \.html$ {
           add_header Cache-Control "public, max-age=3600";
       }
   }
   EOF
   ```

5. **Enable site:**
   ```bash
   ln -s /etc/nginx/sites-available/dash /etc/nginx/sites-enabled/
   nginx -t  # test config
   systemctl restart nginx
   ```

6. **Setup auto-updates (optional, via cron):**
   ```bash
   # Every hour, pull latest and reload Nginx
   0 * * * * cd /var/www/dash && git pull origin main && systemctl reload nginx
   ```

7. **Add HTTPS with Let's Encrypt:**
   ```bash
   apt install -y certbot python3-certbot-nginx
   certbot --nginx -d your-domain.com -d www.your-domain.com
   ```

### Pros:
- Full control, unlimited customization
- Can add backend services later
- No vendor lock-in

### Cons:
- Requires server management
- More initial setup
- You pay for the server

---

## 🔄 Continuous Deployment

All options above support automatic redeployment on push:

```bash
# Just commit and push
git add .
git commit -m "Update dashboard styles"
git push origin main
```

The platform automatically rebuilds and redeploys. No manual steps needed!

---

## 🌍 Custom Domain

For any platform, set your domain DNS to point to the service:

1. **Get the platform's DNS records:**
   - GitHub Pages: `github.com/settings/pages` → view DNS records
   - Vercel: Project Settings → Domains
   - Netlify: Domain Settings
   - Railway: Domains section

2. **Update your domain registrar** (GoDaddy, Namecheap, etc.):
   - Add `CNAME` or `A` records per platform instructions
   - Wait 15 min - 24 hours for DNS propagation

3. **Verify:**
   ```bash
   dig your-domain.com
   ```

---

## 📊 Performance Tips

### Serve Gzipped Assets
Nginx automatically gzips text (CSS, JS, HTML). Enable in Nginx:

```nginx
gzip on;
gzip_types text/plain text/css text/js application/json application/javascript;
gzip_min_length 1000;
```

### Cache Busting
Nginx config above already handles this:
- Static assets (JS, CSS, images): cache 1 year
- HTML: cache 1 hour
- On deploy, file hashes change → automatic cache bust

### CDN (Optional)
For global reach, add Cloudflare (free tier):
1. Change nameservers at domain registrar to Cloudflare
2. Cloudflare automatically caches and serves from edge
3. Automatic HTTPS, DDoS protection

---

## 🔒 Security Checklist

- [ ] HTTPS enabled (all platforms offer free SSL)
- [ ] No API keys in `src/config/platform.js`
- [ ] No secrets in Git history (use `.gitignore` for `.env`)
- [ ] Cross-origin headers correct (no `*` CORS on sensitive endpoints)
- [ ] Input validation on imports (already implemented in `importers.js`)
- [ ] Content Security Policy (CSP) headers (optional, advanced)

---

## 🆘 Troubleshooting

### "Blank page" or 404 after deploy

**Problem:** App loads but pages are empty or 404 errors.

**Solution:** Check browser console (F12) for errors. Common issues:

1. **Wrong base path** — If hosted at `your-domain.com/dash` (not root):
   - All relative imports break
   - Solution: Use absolute paths or set `<base href="/dash/">` in `index.html`

2. **JavaScript module errors** — Check console for import errors
   - Ensure all `import` paths are correct
   - Ensure files exist on the server

### "White screen" or styles not loading

**Problem:** HTML loads but no CSS or JS.

**Solution:**

1. Open DevTools (F12) → Network tab
2. Reload page
3. Look for failed requests (red)
4. Check if CSS/JS files return 404

Fix: Ensure all files are committed to Git and present on server.

### Slow performance

**Problem:** Site loads slowly.

**Solutions:**

1. **Check Lighthouse:** DevTools → Lighthouse → Generate report
2. **Optimize images:** Compress thumbnails, use WebP format
3. **Enable caching:** Nginx config above includes caching
4. **Use CDN:** Cloudflare free tier automatically caches
5. **Lazy load videos:** YouTube embeds load on-demand, not at startup

### "500 errors" on API calls

**Problem:** Import fails or fetch errors.

**Possible causes:**

1. **CORS blocked** — YouTube, other APIs might block requests
   - Solution: Use a CORS proxy or server-side forwarding
   - Example: `https://api.allorigins.win/raw?url=...` (already in use for playlist fetching)

2. **API rate limit** — YouTube noembed fetches might be rate-limited
   - Solution: Add exponential backoff retry logic
   - Or switch to server-side fetching

---

## 🎯 Recommended Setup

**For beginners:** Netlify or Vercel (zero-config, drag-and-drop)

**For production:** Self-hosted with Nginx + Cloudflare CDN (full control, proven)

**For quick prototyping:** GitHub Pages (simplest, free)

---

## 📚 Further Reading

- [GitHub Pages docs](https://pages.github.com)
- [Vercel deployment guide](https://vercel.com/docs)
- [Netlify deployment docs](https://docs.netlify.com)
- [Nginx static site guide](https://docs.nginx.com/nginx/admin-guide/web-server/serving-static-content/)
- [Cloudflare setup guide](https://support.cloudflare.com/hc/en-us/articles/201720164-Creating-a-Cloudflare-account-and-adding-a-website)

---

**Need help?** Open an issue on [GitHub](https://github.com/brandfaux/dash/issues).

**Happy deploying! 🚀**
