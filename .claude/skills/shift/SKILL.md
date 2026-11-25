---
name: shift
description: The lab's daily shift — run the staff on the next claim if one is due, run the weekly pipeline on Sundays, then have the CEO audit the work and write the memo. Runs unattended every morning; also safe to run by hand.
---
Unattended: never ask Ranga questions mid-shift; if something needs him, put it in the memo.
Never commit, push or post.

1. Today = `date +%F` (Asia/Colombo). Target date T = today + 1 day (entries are drafted a day
   ahead so Ranga can review before they go live).
2. **Daily claim.** If `days/T.md` already exists, skip and note "pipeline already ahead".
   If the working tree has uncommitted files in `days/` or `threads/`, skip and note
   "previous draft still waiting for review" (don't pile drafts on Ranga).
   Otherwise run the `/day` pipeline exactly as `.claude/skills/day/SKILL.md` says, with
   date = T. Do not stop to show Ranga anything; the CEO memo is the hand-off.
3. **Weekly.** If today is Sunday and `weekly/` has no file for this ISO week, run `/week`
   without asking for reader input (note in the memo that none was supplied).
4. **CEO.** Spawn the `ceo` agent with: today's date, a short factual account of what steps
   2 and 3 did (claim ID, verdict, any [UNVERIFIED], or why skipped), the output of
   `git status --short` and `git log --oneline -15`.
5. Print the memo path and its Status line as the final output.
