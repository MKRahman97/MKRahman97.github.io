# CLAUDE.md — MKRahman97.github.io

Personal portfolio site for Mohammed Rahman. Static HTML/CSS/JS, hosted on GitHub Pages from `main`.

## The golden rule

**Never edit `index.html` to change text.** All content lives in `content.json`. Edit that file only.

## File structure

- `content.json` — single source of truth for all text, links, papers, skills and contact settings
- `index.html` — structural skeleton only; dynamic parts are empty containers filled by JS
- `script.js` — fetches `content.json` on load and builds the DOM (hero, spectrum, work, timeline, papers, skills, contact)
- `style.css` — all styling. One layout (IBM Plex type) with two colour themes: `:root[data-theme="dark"]` (navy instrument display, teal and amber) and `:root[data-theme="light"]` (white and blue). Theme blocks only set colour tokens; never add layout rules per theme.
- `Images/` — `headshot.jpg` (900px) and `headshot-sm.jpg` (480px), `Mohammed_Rahman_CV.pdf`

## Light and dark theme

The inline `<script>` in `<head>` sets `data-theme` before first paint: the visitor's saved choice (`localStorage.theme`), else their system `prefers-color-scheme`. The sun/moon button in the top bar (`#theme-toggle`, `initTheme`/`applyTheme` in `script.js`) switches and saves it, and updates the `theme-color` meta. Any new colour must be a token defined in both theme blocks; check text contrast in both.

## Viewing locally

`fetch()` is blocked on `file://`. Always serve via HTTP:
- `python -m http.server 8765 --directory .` then open `http://localhost:8765`
- or VS Code Live Server

Hard refresh after edits: **Ctrl+Shift+R**

## content.json structure

```
meta:        siteTitle, brand, authorName (bolded in author lists), showAward, footer
hero:        firstName, lastName, role, pitch, readout[{key,value}], cvHref, cvDownloadName, photo, photoAlt
social:      [{ label, href, icon }]          icon = full class string, e.g. "bx bxl-linkedin" or "ai ai-orcid"
spectrum:    [{ id, label, position 0-1, height 0-1, summary, awardSummary?, link, linkText }]
work:        [{ id, name, expansion, org, years, featured?, award?, summary, points?, result, stack[], link?, linkText? }]
experience:  [{ years, role, org, location, points[] }]
education:   [{ years, degree, org, note? }]
paperTopics: [{ id, label }]                   filter chips; "all" plus topic ids used below
publications:[{ year, title, authors, journal, volume?, doi | url, topic, firstAuthor }]
skills:      [{ group, items[] }]
contact:     { intro, email, mailSubject, web3formsKey, formSubject }
```

## Common update tasks

**Award** — the MOSAIC award line is written but hidden. Set `meta.showAward` to `true` once it has been presented (Dec 2026). Never name the award scheme; it's just "award".

**Add a paper** — add an item to `publications` (newest first) with its DOI. Use `"M. Rahman"` in `authors` so it is bolded. Check the DOI on Crossref.

**Add a job** — add to the top of `experience`.

**Update the CV PDF** — the public CV source is `../website_cv/Mohammed_Rahman_CV_Website.yaml` (personal email, no phone, no internal cost figures). Render with `./render_cv.sh website_cv/Mohammed_Rahman_CV_Website.yaml` from the workspace root, then copy `website_cv/Mohammed_Rahman_CV.pdf` to `Images/Mohammed_Rahman_CV.pdf`.

**Turn on the contact form** — create a free access key at https://web3forms.com with the personal Gmail and paste it into `contact.web3formsKey`. With no key, the page shows Email / Copy email / LinkedIn only.

## Public-content rules

- Write for a reader outside GSK. Lead with what a tool does ("Oligonucleotide analysis platform", "Automated lab data pipeline"); in-house names (MOSAIC, FIL) appear only in the `expansion` line. Keep spectrum peak labels to about 12 characters so they don't collide on phones.
- Don't mention earlier internal tools; MOSAIC is the story (see the workspace-level CLAUDE.md for the names to avoid).
- No internal cost figures, CRO partner names or internal system/catalog names.
- MOSAIC is rules and physics based: never call it ML or AI.
- Just "Claude Code", never "Claude Code, an agentic AI coding tool".

## Agents

- **coach-carter** — knows Mohammed's career profile. Use it to draft new `content.json` entries when the CV changes.
- **Axeman** — bio copy and tone for `hero.pitch` and `contact.intro`.
