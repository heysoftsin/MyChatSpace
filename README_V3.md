# PrivateChat v3

Run `supabase.sql`, then `supabase_v3.sql`.

Added:
- online presence
- typing presence foundation
- message replies
- edit/delete own messages
- reactions
- message search
- browser notification permission
- display name and bio
- block/report database foundation
- owner-only member removal
- 1/2/unlimited private media views

Voice messages and voice/video calls need WebRTC signaling; they should be added as a dedicated call layer rather than pretending an uploaded video is a live call.
