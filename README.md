# PrivateChat v2

This version adds:

- Google account login through Supabase Auth
- Globally unique usernames
- Room owner/admin status
- Owner-only member removal
- Username invites + room codes
- Realtime text chat
- Photo and video sharing
- 1-view, 2-view, or unlimited media
- Private Storage bucket
- Server-side view consumption
- Mobile-friendly UI

## Supabase setup

### Google login
In Supabase go to **Authentication → Providers → Google** and enable Google.
Create/configure your Google OAuth credentials there. Add your deployed Netlify/GitHub URL to Supabase's Auth redirect URLs.

The username-only button is only a testing convenience and uses anonymous authentication. For a real deployment, use Google login so users can recover their account and use it on multiple devices.

### Database
Run `supabase.sql` in Supabase SQL Editor.

The new SQL uses `is_room_member()` as a `security definer` helper, so it avoids the `infinite recursion detected in policy for relation "room_members"` error from the earlier version.

### Frontend
In `app.js` set:

```js
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_OR_PUBLISHABLE_KEY";
```

Never put a `service_role`/secret key in browser code.

## One/two-view media

The bucket is private. A database function atomically increments `view_count` and refuses additional opens after the configured limit. The Edge Function then creates a **60-second signed URL** using the service-role key, which stays server-side.

Deploy the Edge Function as `open-media` and make sure the Edge Function environment has the standard Supabase variables plus `SUPABASE_SERVICE_ROLE_KEY`.

With Supabase CLI, from this project:

```bash
supabase functions deploy open-media
```

Do not commit a service-role key into this repository. Supabase supplies it to the deployed function as a secret/environment variable.

## Deploy the website

Netlify/GitHub Pages only need the static files. No frontend build command is required.

For Netlify, upload/connect the folder and publish `.`.

## Security note

A 1-view media setting controls access through this application's server-side media endpoint. It cannot prevent screenshots, screen recording, or someone photographing the screen.

This is still not end-to-end encryption like Signal: the Supabase project/database administrators can access application data.

## Suggested next features

- typing indicator
- online/offline presence
- read receipts
- reactions
- reply/quote messages
- edit/delete messages
- block/report users
- profile photos
- push notifications
- rate limiting/anti-spam
- automatic deletion of expired media
- end-to-end encryption
