# PrivateChat

A small Telegram/WhatsApp-style private chat website designed to deploy as a static site on **Netlify or GitHub Pages** with **Supabase** providing authentication, realtime database, and image storage.

## Features

- One-time username selection
- Private rooms
- Unique 8-character room codes
- Join a room with a code
- Invite/ping another user by username
- Realtime text messages
- Image sharing
- Mobile-friendly layout
- No custom server required
- Static frontend suitable for Netlify/GitHub Pages

## 1. Create Supabase

Create a free Supabase project.

In **Authentication → Providers**, enable **Anonymous Sign-Ins**.

Then open **SQL Editor** and run all of `supabase.sql`.

## 2. Connect the frontend

Open `app.js` and replace:

```js
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```

with your project's URL and **anon/publishable key**.

Do NOT use the Supabase `service_role`/secret key in browser code.

You can find these in your Supabase project's API settings.

## 3. Test locally

Because the browser may restrict some functionality when opening `index.html` directly, use a local server.

For Python:

```bash
python -m http.server 8000
```

Then visit:

`http://localhost:8000`

## 4. Deploy to Netlify

Drag the project folder into Netlify Drop, or connect the GitHub repository.

No build command is required.

Publish directory:

`.`

## 5. Deploy to GitHub Pages

Upload these files to a repository and enable GitHub Pages for the branch/folder containing `index.html`.

## Important privacy/security note

This is a private-room chat application, but it is **not end-to-end encrypted like Signal**. Supabase/database administrators can technically access stored messages and public image URLs.

For a production app, consider:
- email/OAuth accounts instead of anonymous accounts
- stronger abuse/rate-limit controls
- private Supabase Storage buckets with signed URLs
- message deletion/editing
- blocking/reporting
- end-to-end encryption if you need true message confidentiality
- moderation and file scanning

Anonymous accounts also mean users can lose access if their browser/session is lost. For a serious production service, add a real account/recovery method.

## Project files

- `index.html` — app UI
- `style.css` — responsive dark UI
- `app.js` — chat logic
- `supabase.sql` — database, RLS, storage and helper functions
