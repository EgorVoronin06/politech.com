# ArtLab Deploy

## Quick Deploy (Render)

1. Open [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** -> **Blueprint**.
3. Select repository `EgorVoronin06/politech.com`.
4. Render will detect `render.yaml` automatically.
5. In environment variables set:
   - `EDITOR_KEY` = your secret key
   - `EDITOR_PATH` = hidden admin path (optional)
6. Start deploy.

After deploy:
- Site: `https://<your-service>.onrender.com/`
- Admin: `https://<your-service>.onrender.com/editor-7f3k2` (or your `EDITOR_PATH`)

## Local Run

```bash
npm install
npm run build
npm run server
```
