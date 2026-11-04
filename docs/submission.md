# Submission form drafts

Drafts for the Cerebral Valley submission form. The author reviews and edits them before sending.

> ⚠️ Before sending: the WhatsApp sentences assume the real test of task 7.4 passed. If the Meta app
> and number are not set up in time, describe it as "webhook built and tested with signed events,
> not yet connected to a number" or remove it.

## Project description

Glosa turns hours of video into searchable, citable knowledge. Pick a collection of sermons,
lectures or talks, and Glosa transcribes it, reads what was written on screen, and lets you search
by what was said or ask questions across the whole collection. Every answer is a set of claims with
verbatim quotes, and every quote is checked against the transcript on the server and anchored to
the exact minute before you see it; the model never writes a timestamp. You can ask in any
language, typed or dictated, and watch the agent's real steps in the margin as it works. Verified
quotes become investigations you can publish, 40-second captioned clips, or illustrated cards with
a QR code to the minute. Editors group videos into series you can question on their own, and
approved topics become tags. It also builds a Scripture index checked against the real chapters
and verses, hides prayer requests about sick or grieving people until an editor decides, and blurs
the congregation in frames with SAM 3.1 so only the speaker is visible. Questions also work from
WhatsApp, and every quote can open the original on YouTube at the same minute. It is built for a
pastor, a teacher or a student who needs to search, cite and teach from a mountain of video.

## Describe your use of Meta products to build the submitted project

- **Muse Voice Transcribe** transcribes Spanish audio, biased with the names of the books of the
  Bible. Because the API gives turn-level timestamps and a reading can be one 2-minute turn, we cut
  the audio into 30 s windows overlapping by 5 s, transcribe them in parallel and merge the overlap
  by word alignment. That gives fragments of 20 s or less with real timestamps.
- **Muse Spark with function calling** (Chat Completions) is the research agent. It has five
  read-only tools over our index (search, read context, on-screen text, Scripture passages, list
  videos) and reformulates its searches on its own.
- **Muse Spark with structured output** writes the final answer as claims with fragment ids and
  verbatim quotes. It also classifies sensitive passages about private people and drafts each
  video's summary and topics for human approval.
- **Muse Spark video understanding with the Files API** (Responses API) reads slides and whiteboards
  in 10-minute segments. Files are uploaded with `expires_after` and deleted after the analysis.
- **Muse Spark translation** answers in the language of the question and translates only the quotes
  that passed verification, plus English captions. The original stays as the evidence.
- **Muse Voice Transcribe** also takes dictated questions from the browser.
- **Muse Image** draws the illustration of quote cards and investigation covers, from an abstract
  theme only (no people, faces or text); ffmpeg composes the quote, source and QR code.
- **SAM 3.1** finds every person in a frame. We pick the speaker (the centred person standing
  highest) and blur everyone else; cached per frame and counted in the daily spending cap.
- **WhatsApp Cloud API** (Graph API) receives questions through a signed webhook and sends back the
  answer with up to three verified quotes and links.
- We used the Standard tier only; contributor mode is refused in code because the content belongs to
  a congregation.

## Why are Meta's models important to your solution?

Glosa needs three things from one family of models. It needs good Spanish speech recognition at a
price that makes whole archives affordable (US$0.18 per hour). It needs an agent that can search
and reason over a long collection, with structured output we can verify. And it needs a model that
can watch the video, because slides and whiteboards carry the outline of a sermon. Muse Spark
reading the screen gave us second-accurate moments for what was written, which is something no
transcript can recover. And the 1M-token context means a collection's transcripts fit when the agent
needs to read widely. SAM 3.1 lets us protect the people in the pews, who never agreed to be on a
public site, without giving up the frames that show the slides. Muse Image turns a verified quote
into something people actually share, and WhatsApp puts the archive where the congregation already
talks. Having all of it behind one OpenAI-compatible API let one person build the whole pipeline in
days.

## Feedback from your experience using Meta products

- `POST /v1/responses/input_tokens` returns the same small count for a 1-minute and a 43-minute video,
  so it does not count video tokens. We had to measure with real calls: 1 min ≈ 16.5 K tokens,
  10 min ≈ 86 K, 43 min ≈ 111 K.
- Muse Spark is excellent at _when_ something appears on screen (exact to the second in 10-minute
  segments) but is off by 1–2 minutes on _when_ something was said. A note in the video docs would
  save developers from citing wrong minutes.
- Muse Voice Transcribe returns turn-level timestamps only, and one turn can last minutes. Word-level
  or segment-level timestamps would remove the need for overlapping windows.
- The one-shot transcription limit (10 min / 32 MB WAV) is clear in the docs and easy to work with.
- Tool calling works on Chat Completions and video on the Responses API. Having both on one endpoint
  would simplify agents that watch video.
- There is no embeddings model in the API; we designed around lexical search plus an agent, but
  embeddings would help paraphrase search.
- Muse Code defaults to contributor mode. A clearer warning would help when it opens client code.
- SAM 3.1 was fast (1–2 s per 640 px frame) and found 21 people in a crowded synthetic test scene. The
  mask payload is a custom base85 encoding without a published decoder, so we blur by box; a small
  reference decoder in the docs would let developers use the pixel-accurate masks.
- SAM's `usage` reports `images_processed` and zero tokens, which made per-frame cost accounting easy.
- Muse Image returns 1280×1920 when asked for `1024x1536`; documenting the real output sizes would
  help layout code.

## Provide feedback from your experience using partner technologies

We did not use Fireworks, Modal or Baseten in this submission; everything runs on the Meta Model API.
