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
NEXT_PUBLIC_SITE_URL=https://centuryblogg.vercel.app
ADMIN_USERNAME=theovin4
ADMIN_PASSWORD=madrid433.
ADMIN_SESSION_SECRET=change-this-secret
NEXT_PUBLIC_SUBSTACK_URL=https://centuryblog.substack.com
```

Optional for Vercel persistence:

```env
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

Optional for direct Substack forwarding from the newsletter form:

```env
SUBSTACK_SUBSCRIBE_URL=your_exact_substack_form_action
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

Current deployment URL: `https://centuryblogg.vercel.app`. Update `NEXT_PUBLIC_SITE_URL` again if you later attach a custom domain.
