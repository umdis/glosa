# Glosa

**Turn footage into footnotes.**

A _glosa_ is the note a medieval scribe wrote in the margin of a manuscript to explain the text.
Glosa does that for video: it turns hours of sermons, lectures and talks into a searchable,
citable text, and every answer it gives points to the exact moment that supports it, **checked
against what was actually said before you see it.**

Built for the [Meta Global AI Developer Hackathon](https://cerebralvalley.ai/e/meta-ai-developer-hackathon)
(Indie Developer track, theme _Build for Your World_). Everything in this repository was written
during the hackathon (October 26 – November 4, 2026); the commit history shows it.

## The problem

Some of the most valuable knowledge a community has lives in long videos: years of sermons, classes
and talks. You cannot search what was said, you cannot find the minute where something was
explained, and when you write a study from that material you copy quotes and timestamps by hand.
General AI chat makes it worse in a quiet way: it summarizes confidently and cites the wrong minute.

## What Glosa does

- **Search by what was said**, across the whole collection, in Spanish (word forms and accents
  included). Results read like a Bible concordance: the word in the middle, the context around it,
  and a folio that plays the video at that moment.
- **Ask the collection.** A research agent searches the transcripts several times with different
  words, reads the context and answers in short claims. Each claim carries verbatim quotes.
- **Verified citations.** The server checks every quote against the transcript before showing it,
  anchors it to the real minute, and marks anything it cannot find as _not found_. The model never
  writes a timestamp.
- **What was on screen.** Slides and whiteboards are read from the video itself and placed in the
  transcript at the second they appear.
- **Scripture index.** Every Bible passage spoken or shown is detected, checked against the real
  chapters and verses of its book, and listed in canonical order with links to each moment.
- **Privacy for the people who are not there.** Sermons end with prayer requests that name sick or
  grieving people. Glosa hides those passages until an editor decides; they never reach search, the
  agent or the public page.
- **AI proposes, a person decides.** Summaries and topics are drafts until an editor approves them.
- **Write a study** from an answer: Markdown with the verified quotes linked to their moments, ready
  to edit, download or print.

## How it uses Meta's models

| Model                                                                            | What Glosa does with it                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`)                          | Transcribes Spanish speech with speaker turns, biased with the names of the books of the Bible. Audio is cut into 30 s windows that overlap by 5 s and are transcribed in parallel, so turns never exceed 20 s (the API returns turn-level timestamps, and a long reading can be one 2-minute turn). The overlap is merged by word alignment, which recovers words cut at window edges. |
| **Muse Spark** (`muse-spark-1.3`) via Chat Completions with **function calling** | The research agent: `buscar`, `leer_fragmentos`, `en_pantalla`, `pasajes`, `listar_videos`.                                                                                                                                                                                                                                                                                             |
| **Muse Spark** with **structured output** (JSON schema)                          | The final answer (claims and quotes), the sensitive-passage review, and the catalogue summary.                                                                                                                                                                                                                                                                                          |
| **Muse Spark video understanding** via the Responses API and the **Files API**   | Reads slides and whiteboards in 10-minute segments. Files are uploaded with `expires_after` and deleted right after the analysis.                                                                                                                                                                                                                                                       |

Glosa always uses the Standard tier. Contributor mode trains on the data sent, so it is refused in
code.

### What we measured before designing

| Measurement                                                                | Result                                                                                         |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Spanish transcription, 10 min of a sermon                                  | Very good, 73 s, about US$0.03                                                                 |
| Muse Spark asked _when_ something was **said**                             | Off by 1 to 2 minutes, so spoken timestamps come only from the transcript                      |
| Muse Spark asked _when_ something appeared **on screen** (10-min segments) | Exact to the second, checked frame by frame                                                    |
| Video tokens                                                               | 1 min ≈ 16.5 K, 10 min ≈ 86 K, 43 min ≈ 111 K: long videos lose detail, so segments are 10 min |

### Results on two real sermons (43 and 69 minutes)

- **65 of 65** quotes verified across 11 real questions, each linked to the right minute.
  A question about astronomy correctly returned _no evidence_.
- The prayer-request block (names, diagnoses, deaths) was hidden automatically. A control question,
  _"Who did they pray for?"_, first exposed two names that sat at the edge of the block. The
  safeguards were tightened (gaps of up to 3 fragments are filled and each block grows by one
  fragment on each side) and the same question now answers without names.
- Scripture index for the first sermon: James 1:2, James 1:12 and Philippians 4:8, exactly the
  passages the preacher cited, including _"in verse twelve…"_ said eight minutes after the book.
- Processing both sermons cost about US$2 of API usage in total.

## Architecture

```
upload ─▶ ffmpeg: H.264 480p for playback + WAV 24 kHz
          ├─▶ 30 s overlapping windows ─▶ Muse Voice Transcribe (×8 in parallel)
          │       └─▶ merge by word alignment ─▶ fragments ≤ 20 s (hidden until reviewed)
          ├─▶ Muse Spark: sensitive passages ─▶ hidden + review queue; the rest is published
          ├─▶ Scripture detector (rules + canon table) ─▶ passage index
          ├─▶ Muse Spark: summary and topics ─▶ review queue
          └─▶ 10-min segments ─▶ Files API ─▶ Muse Spark video ─▶ text on screen + passages

question ─▶ agent (Muse Spark + tools over SQLite FTS5) ─▶ structured claims with quotes
         ─▶ server verification against the transcript ─▶ answer with verified minutes
```

- **SvelteKit 3** (Svelte 5, TypeScript) in a single container, **SQLite** with FTS5: one index by
  Spanish word stems (Snowball, applied before removing accents) and one by trigrams, which keeps the
  ñ (`año` ≠ `ano`).
- There is no embeddings model in Meta's API. Instead of a basic RAG pipeline, the agent searches
  lexically with several reformulations and reads the fragments; then the server verifies.
- The canon table (66 books, 1,189 chapters, 31,102 verses) is generated from the public-domain
  King James Version of 1769 ([scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases),
  MIT), with Reina-Valera 1960 versification where it differs.

## Run it

Requirements: Node 22 and ffmpeg. npm 11 is needed: the npm 10.9 bundled with Node 22.18 fails to
resolve this dependency tree.

```bash
npx npm@11 ci
cp .env.example .env        # set MODEL_API_KEY and ADMIN_TOKEN
npm run dev                 # or: npm run build && node build
npm test                    # unit tests
```

Or with Docker: `docker build -t glosa .` then
`docker run -p 3000:3000 -v glosa-data:/data --env-file .env glosa`.

Open `/admin`, sign in with `ADMIN_TOKEN`, and upload a video **you have permission to publish**.

| Variable                      | Purpose                                               |
| ----------------------------- | ----------------------------------------------------- |
| `MODEL_API_KEY`               | Meta Model API key (server only)                      |
| `ADMIN_TOKEN`                 | Editor key for uploads and reviews                    |
| `DAILY_SPEND_CAP_USD`         | Daily AI spending cap for the public demo (default 5) |
| `DATA_DIR`                    | Database and media folder (`/data` in the container)  |
| `FFMPEG_PATH`, `FFPROBE_PATH` | Optional paths to ffmpeg and ffprobe                  |

## Accessibility and care

- WCAG 2.2 AA contrast, measured in light and dark themes.
- Keyboard-first controls, captions generated from the transcript, and `lang` set on Spanish
  content.
- `prefers-reduced-motion` respected; reflow checked at 320 px.
- Public visitors cannot upload or change anything. Questions are limited per visitor and by a
  daily spending cap.

## Status

Built during the hackathon. The specification, design decisions and task list live in
[`openspec/changes/nucleo-glosa`](openspec/changes/nucleo-glosa).

## License

To be decided by the author before the submission.
