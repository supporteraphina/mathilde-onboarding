# Mathilde Onboarding

Personalized onboarding site for Mathilde Tantot, adapted from the standard model
onboarding funnel. Terracotta colorway, Bodoni Moda and Hanken Grotesk, her portrait
on the welcome screen, French touches in the copy. `server.js` serves the static page
and proxies submissions to Airtable, using the same field contract as the standard
funnel.

## Her portrait

The welcome portrait is `mathilde.jpg` next to `index.html`. To swap it, replace the
file with a portrait crop (4:5, at least 800px wide) and redeploy. If the file is
missing the site shows a monogram fallback instead of a broken image.

## Deploy on Railway

1. Push this folder to a GitHub repo and create a new Railway service from it, or run
   `railway init` and `railway up` from this folder with the Railway CLI. Railway
   detects `package.json` and runs `npm start`.
2. In the Railway service, add three variables, using the same values as the previous
   onboarding site:
   - `AIRTABLE_TOKEN` = scoped PAT with `data.records:write` on the base
   - `AIRTABLE_BASE`  = app…
   - `AIRTABLE_TABLE` = tbl… (or the exact table name, defaults to `Models`)
3. Add a domain in Railway settings. `mathilde.halevora.com` fits the "built for you"
   feeling; point a CNAME at the Railway domain.

Airtable needs nothing new if you reuse the existing base and `Models` table. Her row
lands next to the other models. For a dedicated table, duplicate the table empty, or
import `airtable_import.csv`, then set `AIRTABLE_TABLE` to it.

## Notes

- Answers auto-save on her device (localStorage key `halevora_mathilde_onboarding_v1`),
  so she can close the tab and resume.
- Only Stage Name, Age, Timezone and Location are required. She can skip everything else.
- If a column is renamed or missing in Airtable, the server drops that one field and
  still saves the rest (logged in the deploy logs).
- Local preview: `node server.js`, then open localhost:4180.
- The page is `noindex, nofollow`. It is hers, not for Google.
