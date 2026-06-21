# Supabase Setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase-setup.sql`.
3. Open `supabase-config.js` and set:
   - `url` to your project URL (for example `https://xyzcompany.supabase.co`)
   - `anonKey` to your public `anon` or `sb_publishable_...` key
4. Reload `login.html`, `admin.html`, or `student.html`.

Notes:
- The app still works locally when Supabase is not configured.
- Do not put `service_role` keys in `supabase-config.js`.
