# Nika Catalog — User Guide

Nika Catalog turns the release emails and files your labels send into clean,
structured catalog lines that you review and push to Hermes.

> 📷 *[Screenshot: the app with the left menu and the Catalog open]*

## The four areas (left menu)

- **Catalog** — your working list of releases: review, edit, approve and send to Hermes.
- **Raw Entries** — the audit log of every email/file the system processed.
- **Import** — upload a file manually (Excel/PDF) when something didn't arrive by email.
- **Settings** — the rules the system follows (senders, glossary, exclusions…).

---

## Your daily workflow

**1. New lines arrive automatically.**
When a label sends an email (or you upload a file under *Import*), the system reads
it, extracts each release, and adds the lines to the **Catalog** with status
**In progress**.

**2. Review & edit.**
Open the Catalog and check the new lines. Click the ✏️ pencil to edit any field. Watch for:
- The **Exclusion reason** column — why a line was auto-excluded (e.g. a territory restriction).
- Lines missing key info (no price, no release date) — complete them if you have the data.

> 📷 *[Screenshot: the edit dialog for a catalog line]*

**3. Approve.**
Tick the lines that are ready and click **Approve**. They stay selected, so you can
send them straight away.

**4. Send to Hermes.**
With approved lines selected, click **Send to Hermes**. The **Hermes** column turns
to **sent**. ⚠️ This writes to the live Hermes system.

> 📷 *[Screenshot: the toolbar with Approve and Send to Hermes]*

---

## Main Catalog vs Other Catalog

The Catalog has two tabs:
- **Main Catalog** — everything by default.
- **Other Catalog** — releases from **Matrix Music, I-DI music and Pias Recordings**.

Both tabs work exactly the same way. To move a line between them, edit it and change
the **Catalog** field.

> 📷 *[Screenshot: the Main / Other Catalog tabs]*

---

## Good to know

- **Status vs Hermes.** The **Status** column is your workflow (In progress → Approved).
  Whether a line reached Hermes is shown separately in the **Hermes** column.
- **Automatic updates.** When a follow-up email arrives about a release already in the
  list, the system **updates that line** instead of creating a duplicate — only the new
  information changes; the rest is kept, including anything you typed yourself (such as
  **Our price**) and which catalog tab you moved the line to. Lines are matched on the
  **EAN**, and failing that on the **catalogue number** — never on artist and title,
  since the same artist, title and format is often several different products. A release
  that arrives with neither identifier is always added as a new line, so those are the
  ones to merge by hand.
- **Already approved, already sent.** An approved line that has *not* gone to Hermes yet
  is still updated automatically, but its status stays **Approved** — the system never
  silently un-approves your work. Once a line has been **sent** to Hermes it is frozen:
  Hermes cannot take an update, so a later email is recorded in the hidden **Late
  update** column instead of being applied. Turn that column on via **Columns** if a
  release date looks out of date.
- **Nothing is excluded on a guess.** A release is only excluded when the email clearly
  says it cannot be sold here. "WW ex US" means *everywhere except the US*, so it stays
  in the catalog. Where the wording is genuinely unclear the line is kept and a note is
  left in the hidden **Review note** column.
- **Search & filter.** Use the search box and the per-column filter icons — filters
  cover the **whole** catalog, not just the visible page.
- **Columns.** Use **Columns** to show/hide columns (some are hidden by default).
- **Export.** **Export** downloads an Excel (.xlsx) laid out like your own catalogue
  workbook. Dates come out as `DD.MM.YYYY`, the calculation group as **F/M/B**, and the
  EAN keeps its leading zeros. Prices are real numbers, so the **Our price 95%** column
  is a live formula — change **Our price** in Excel and it recalculates itself.

---

## Settings — the rules you maintain

Under **Settings** you keep the rules the system applies. Keep them up to date — the
better the rules, the better the extraction.

- **Senders** — which email/label maps to which record label (and its supplier code).
- **Glossary** — acronyms / code-words (e.g. LP, 2LP, OST).
- **Exclusions** — keywords that auto-reject an item (e.g. D2C).
- **Mandatory fields** — fields a line must have.
- **Label notes** — quirks per label.

> 📷 *[Screenshot: the Settings page with its tabs]*

---

## Manual import

If a release list didn't arrive by email, go to **Import**, upload the file
(Excel/PDF), and the same extraction runs automatically.

> 📷 *[Screenshot: the Import page]*

---

*Questions, or something looks off? Contact HiHuman and we'll sort it out.*
