# Votalume Repository Instructions

## Project Overview & Architecture
- **Live Site:** https://grayrosecreations.github.io/votalume/ (GitHub Pages static site)
- **Tech Stack:** Vanilla HTML, CSS, and JavaScript (no build step or framework dependencies unless explicitly requested).
- **Master Database (Google Sheets ID):** `1gcU-CVHfysi37Vtp_aDf6qOUFGUnfrpXpfNDTXBNgaM`
- **Key Tabs:** `Bills_Summary`, `Backfill_Queue`, `House_Summary`, `Senate_Summary`, `House_Votes_Log`, `Senate_Votes_Log`, `Tag_Definitions`, `Site_Metadata`, `Discrepancy_Reports`, `Suggestions`

## Configuration Constants (`js/config.js`)
- Always check `js/config.js` first for shared constants (`SHEET_ID`, `REPORT_WEBHOOK_URL`, `KOFI_URL`).
- **Ko-fi Donation URL:** `https://ko-fi.com/C8M02B83R2` (Widget ID: `C8M02B83R2`, color `#72a4f2`).
- **Webhook Routing:** Both Discrepancy Reports (`submission_type: "discrepancy"`) and User Suggestions (`submission_type: "suggestion"`) submit to `REPORT_WEBHOOK_URL` (Google Apps Script `doPost(e)` endpoint). Use `Content-Type: text/plain;charset=utf-8` (or standard Apps Script fetch handling) so browser CORS preflight checks do not block submissions.

## Editorial & Accessibility Guardrails
- **Strict Anonymity:** Never include the creator's real name, family names, or city/county location anywhere in the site copy, metadata, or comments.
- **Nonpartisan & Plain English:** Keep all user-facing copy strictly nonpartisan and written at an 8th-grade reading level.
- **Accessibility (WCAG 2.1 AA):** Maintain `16px+` body font sizes, `>= 4.5:1` color contrast, keyboard navigation, and pair icons with text labels on all badges (never rely on color alone).
- **Honest Data Counts:** Never hardcode bill counts or `100%` completion rates; always compute dynamically from the full sheet rows.