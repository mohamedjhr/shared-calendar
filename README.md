# Calendrier partagé — GitHub Pages + Supabase

## Set up Supabase
1. Create a project on https://supabase.com/dashboard.
2. Open **SQL Editor** > **New query**. Paste `supabase-setup.sql` and run.
3. If the publication statement reports that the table is already in `supabase_realtime`, that's fine: it is already enabled. If the Cron statement fails, enable the `pg_cron` extension in **Database > Extensions** and rerun that last block.
4. From **Project Settings > API Keys** (or **Connect**, depending on your dashboard version), copy the project URL and **publishable key** (legacy anon key also works).
5. Replace the placeholders in `config.js`. Never expose a `service_role` or secret key.

## Publish GitHub Pages
1. Create a public repository, e.g. `shared-calendar`.
2. Upload `index.html`, `style.css`, `app.js`, `config.js`, `supabase-setup.sql`, `README.md` to the repository root.
3. Open **Settings > Pages > Build and deployment**, choose **Deploy from a branch**, `main`, `/ (root)`, and save.
4. Open `https://YOUR-USERNAME.github.io/shared-calendar/`.
5. Open the site on two devices, book a slot on one, confirm it appears on the other.

## Notes
- Calendar time zone: **Europe/Brussels**.
- Current/next weeks only (Monday–Sunday). A collapsed 14:00–16:00 section; one 22:00+ slot each day.
- Database key is intentionally public; it is the **publishable** key. RLS is enabled, but since no login is required anyone with the URL can view, book, rename, or delete reservations. Do not use for confidential information.
- Old bookings are invisible as soon as the week changes, and the scheduled database cleanup deletes them later.
- Realtime plus a 20-second fallback refresh supports sync.


## Images et version française
- Le site est traduit en français et utilise un thème sombre (dégradé noir / noir doux, texte blanc / gris).
- Placez `logo.png` et `partners.png` dans le dossier `images/` (respectez exactement la casse).
- `logo.png` apparaît en haut à gauche (largeur maximale : 190 px sur ordinateur, 150 px sur mobile).
- `partners.png` apparaît centré sous la phrase du pied de page (largeur maximale : 280 px).
- Sans ces fichiers, les images restent masquées ; le calendrier fonctionne normalement.
- Pour la publication GitHub Pages, placez **les fichiers du dossier `shared-calendar` à la racine du dépôt**, et conservez le sous-dossier `images/`.
- Le fichier `supabase-setup.sql` ne change pas : votre base et vos réservations existantes sont préservées.
