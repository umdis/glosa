# Demo video script (3 minutes)

The video shows only what was built during the hackathon. Record it on the deployed demo with the
sermons the church allowed us to publish. Spoken narration in English, with the Spanish on screen
subtitled. Target length: 2:55.

| Time      | On screen                                                                                                                                                                                    | Narration                                                                                                                                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:12 | A long sermon playing; scrolling through hours of video.                                                                                                                                     | "Our church has years of sermons on video. Finding what was said about one topic, at the exact minute, is impossible. And AI chat cites the wrong minute."                                                                                   |
| 0:12–0:22 | Home page: _Turn footage into footnotes_, the colophon with real numbers per model.                                                                                                          | "Glosa turns footage into footnotes. A glosa is the note a scribe wrote in a manuscript's margin. Here, the margin is where the evidence lives."                                                                                             |
| 0:22–0:35 | Search «tentaciones». Concordance results; click a red folio, the video jumps to that second.                                                                                                | "Search by what was said, in Spanish word forms. Every red folio is a moment: click it and the video plays from there."                                                                                                                      |
| 0:35–1:10 | On _Ask_, press the microphone and say in English: _"What reward does someone who endures temptation receive?"_ The margin draws the agent's real steps live; the answer arrives in English. | "Ask in your own language, even by voice. Muse Spark runs as an agent: you can watch it search, read and check in the margin. The answer comes in English; the quotes stay in Spanish, as said, with a translation marked as a reading aid." |
| 1:10–1:20 | Point at a sealed quote and its minute; click it.                                                                                                                                            | "Our server checks every quote against the transcript and anchors it to the real minute. The model never writes a timestamp."                                                                                                                |
| 1:20–1:27 | Ask _"What was said about astronomy?"_ → _no evidence_.                                                                                                                                      | "And when the videos don't talk about something, Glosa says so."                                                                                                                                                                             |
| 1:27–1:50 | _Use this quote → Save to investigation_. In the investigation, _Draft with Spark_; publish; _Make a cover_.                                                                                 | "Collect quotes into an investigation. Muse Spark can draft a section, and its quotes are verified again. Publish it, and Muse Image draws a cover for when you share it."                                                                   |
| 1:50–2:08 | _Make a card_: the illustrated card with the quote and a QR; scan it with a phone, it opens the minute. Then _Make a clip_: the vertical clip with captions.                                 | "Share one moment as a card, with a QR code that opens the exact minute, or as a 40-second clip with captions."                                                                                                                              |
| 2:08–2:22 | _Series & topics_: open a series, ask inside it. Then the Scripture index.                                                                                                                   | "Editors group videos into series you can question on their own: quotes from other videos are rejected. Every Bible passage, spoken or on screen, is checked against the real chapters and verses."                                          |
| 2:22–2:42 | Editor page: hidden prayer requests (names blurred in the video). Then _Visual privacy_: the before/after on a synthetic test scene, labelled as such.                                       | "Sermons end with prayer requests about sick and grieving people, and the congregation never agreed to be online. Glosa hides those passages until a person decides, and SAM 3.1 blurs everyone in the frame except the speaker."            |
| 2:42–2:55 | A phone: a WhatsApp question and the reply with three quotes and links. Then _Watch on YouTube_ at the same minute.                                                                          | "Ask from WhatsApp, where the congregation already talks, and open any quote on YouTube at the same minute. From a mountain of video to something you can search, cite and teach from."                                                      |

Close on: **Glosa — Turn footage into footnotes.** Muse Spark · Muse Voice Transcribe · Muse Image ·
SAM 3.1 · WhatsApp.

## Checklist before recording

- [ ] Written permission from the church to publish the sermons used in the video.
- [ ] Approve the summaries and topics in `/admin` and create one series, so _Series & topics_ has
      content in production.
- [ ] Blur every name in the review-queue shots: the prayer requests are private.
- [ ] Rehearse the questions on the deployed demo, so their saved answers are ready if the API is slow.
- [ ] Captions in English for the Spanish parts.
- [ ] WhatsApp shot only if task 7.4 is done (Meta app and test number); otherwise cut 2:42–2:48
      and keep YouTube.
- [ ] The SAM before/after uses a synthetic image made with Muse Image: say so on screen. The demo
      sermons show only the preacher.
