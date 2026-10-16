# Century Blog

A Next.js editorial publication with a protected newsroom dashboard, article workflows, category pages, and SEO metadata.

## Features

- Dynamic post listing and individual post pages
- Protected dashboard for publishing new posts
- SEO metadata, sitemap, robots, canonical URLs, and JSON-LD
- Local JSON storage for development
- Cloudinary-backed JSON persistence for production (planned relational database migration)

## Environment Variables

Create `.env.local` with:

```env
NEXT_PUBLIC_APP_URL=https://www.centuryblog.com.ng
ADMIN_USERNAME=choose_an_admin_username
ADMIN_PASSWORD=replace_with_unique_long_password
ADMIN_SESSION_SECRET=replace_with_random_secret_at_least_32_bytes
NEXT_PUBLIC_SUBSTACK_URL=https://centuryblog.substack.com
```

For current production persistence, configure the existing Cloudinary integration with private server-side credentials (do not commit values):

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
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
3. Configure Cloudinary credentials in Vercel for the existing persistent content store; do not treat repository `data/posts.json` as the authoritative production database.
4. Add your custom domain in Vercel project settings.

## Note

Primary production URL: `https://www.centuryblog.com.ng`.
Redirect domain: `https://centuryblog.com.ng`.
Set `NEXT_PUBLIC_APP_URL=https://www.centuryblog.com.ng` in Vercel for production, preview, and local environments where you want canonical metadata to reflect the live site.

## Security: credential exposure response

An earlier public version of this README included a credential-like admin password. Treat that value as compromised if it was ever used: rotate `ADMIN_PASSWORD` in Vercel and other affected environments, rotate `ADMIN_SESSION_SECRET` to invalidate existing signed sessions if appropriate, review administrator access logs, and check for password reuse. Removing text from the latest commit **does not remove it from Git history**. Plan a coordinated history cleanup only after preserving required audit evidence and understanding all clone/fork implications.

Never store real secrets, passwords, tokens, or production database credentials in repository documentation, tests, prompts, or client-visible environment variables. See `reports/security-remediation.md` for the required actions.
