---
name: day
description: Run the daily Evidence Ledger pipeline on one claim (next QUEUED in BACKLOG.md, or the claim ID/text given as args).
---
1. Read CLAUDE.md and BACKLOG.md. Pick the claim (args, else first QUEUED). Mark it IN-PROGRESS.
   Day number N = count of files in days/ + 1. Date = today, or the date given by /shift.
2. In ONE message, spawn `advocate` and `prosecutor` agents with the claim text and primary
   source. Give each only the claim — never the other's output.
3. Spawn `judge` with both briefs verbatim.
4. Spawn `writer` with claim, both briefs, verdict, N and date.
5. Update BACKLOG.md row → verdict + date. Recompute the scoreboard table in README.md from days/.
   Append the day to ledger.json (day, date, id, track, title, source, verdict, summary = the
   verdict's one-line reason, survives = the surviving/weaker claim in plain words, file) — the
   website (index.html, entry.html) reads only ledger.json, days/*.md and BACKLOG.md.
6. Show Ranga: verdict line, the thread, and any [UNVERIFIED] items. Do NOT commit or post —
   Ranga reviews first, then says "commit".
