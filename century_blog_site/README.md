# Century Blog

A dark themed, SEO-friendly Next.js blog for lifestyle, health, education, and daily gist, with a lightweight admin dashboard for posting.

## Features

- Dynamic post listing and individual post pages
- Protected dashboard for publishing new posts
- SEO metadata, sitemap, robots, canonical URLs, and JSON-LD
- Local JSON storage for development
- Optional Vercel Blob support for persistence in production

## Environment Variables

Create `.env.local` with:

```env
NEXT_PUBLIC_SITE_URL=https://www.centurybloggs.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
ADMIN_SESSION_SECRET=change-this-secret
```

Optional for Vercel persistence:

```env
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

## Run

```bash
npm install
npm run dev
```

## Deploy To Vercel

1. Import the project into Vercel.
2. Add the environment variables above.
3. If you want dashboard posts to persist in production, add Blob storage and set `BLOB_READ_WRITE_TOKEN`.
4. Add your custom domain in Vercel project settings.

## Note

The requested domain in the brief was `www.centurybloggs.come`. Confirm whether you meant `.com` or `.come` before attaching the final domain in Vercel.
