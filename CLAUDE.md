# Evidence Ledger — one-person research lab

Owner: Ranga (human) — decides, commits, posts. CEO: the `ceo` agent — runs operations, proposes.
Staff: Claude agents in `.claude/agents/`.

## Mission
Two questions, tested one claim per day, in public:
- **SIM** — Are we in a simulation?
- **FW** — Is there free will?

The lab's thesis is "simulation: yes, free will: no". The lab's **method** is to try to kill
that thesis every day. Credibility comes from publishing what died, not only what survived.

## Non-negotiable rules
1. **Verdict first, one line.** Then reasoning.
2. **Every claim gets its strongest attack.** No entry ships without the Prosecutor's case.
3. **No unverified citations.** The Judge checks every paper exists (PubMed / Consensus /
   web). A fake citation is the one thing that ends this lab. Unverified → marked `[UNVERIFIED]` or cut.
4. **Never rewrite history.** Once a day file is committed, verdict changes go in a new
   `## Revision` section with date and reason. Git history is the proof of honesty.
5. **First principles over textbook framing.** Ask what the experiment physically measured,
   not what the abstract says it means.
6. **Signal only.** No padding, no recap of famous background everyone knows.
7. SIM and FW are **separate tracks** — they are logically independent (a simulation can
   contain real choice). Never let one claim count for both without arguing the link.

## Verdicts
| Verdict | Meaning |
|---|---|
| **SURVIVES** | Strongest known attack fails; claim stands as evidence for the thesis |
| **WOUNDED** | Claim holds in a weaker form; state the weaker form exactly, plus the line "Weaker form is evidence for the thesis: yes/no, because …". If no → **DEAD** |
| **DEAD** | Attack succeeds; claim is not evidence for the thesis |
| **UNFALSIFIABLE** | No observation could distinguish it; it is philosophy, not evidence. Scored separately |

## Daily pipeline (`/day`)
1. Pick next `QUEUED` claim from `BACKLOG.md` (or one Ranga names).
2. **Advocate** and **Prosecutor** run in parallel, blind to each other.
3. **Judge** reads both, verifies citations, writes verdict.
4. **Writer** produces `days/YYYY-MM-DD.md` (from `TEMPLATE.md`) and `threads/YYYY-MM-DD.md`.
5. Update `BACKLOG.md` status and the scoreboard in `README.md`.
6. Ranga reviews → commits → posts. Agents never post anything externally.

## Daily shift (`/shift`, 07:00 Asia/Colombo via launchd)
`scripts/shift.sh` runs `/shift` unattended: drafts the next day's claim (dated tomorrow) unless one
is already drafted or still awaiting review, runs `/week` on Sundays, then the **CEO** audits the
output and writes `ops/memos/YYYY-MM-DD.md`. Commits, pushes and posts are blocked in that run.
The CEO proposes improvements and hires in `ops/LOG.md` and `ops/proposals/`; nothing changes
until Ranga approves. `ops/` is private (gitignored).

## Weekly pipeline (`/week`, Sundays)
1. **Scout** refills backlog to ≥ 14 queued claims (new papers, reader challenges, Ranga's ideas).
2. **Writer** drafts the Reddit roundup in `weekly/YYYY-Www.md`.
3. Strong counter-arguments from readers become new backlog items tagged `reader`.

## Channels
- Repo (public GitHub, later) — the record.
- X / Threads — daily thread.
- Reddit r/freewill, r/philosophy — weekly roundup only (self-promo rules).
