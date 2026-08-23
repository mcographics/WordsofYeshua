# Content model and editorial rules

Each record represents one coherent saying or short teaching unit and includes its exact quotation and reference, narrative event, teaching themes, people or audience, place, physical objects or symbols, broad ministry period, immediate context, and editorial timeline order.

## Full-corpus acceptance criteria

1. Use and document the local King James Version as the base translation.
2. Define how parallel Gospel accounts are displayed without pretending they are one quotation.
3. Tag every speech unit in Matthew, Mark, Luke, and John, including parables, questions, prayers, post-resurrection words, and short replies.
4. Include the words attributed to Jesus in Acts and Revelation only through a reviewed allowlist: explicit risen-Christ speech, an explicit recollection or quotation of Jesus, and Christ’s messages to the seven churches.
5. Distinguish Jesus’ words from narratorial text and speech attributed to the Father, Holy Spirit, angels, worshippers, or other people.
6. Avoid unsupported precision for disputed chronology or uncertain locations.
7. Have a second person review every quotation, reference, and contextual claim against the source text.
8. Run automated checks for duplicate IDs, missing fields, unknown controlled terms, malformed references, and uncovered speech passages.

## Local generation sources

The repeatable generator reads `data/translations/kjv.docx` for exact verse text and section headings, `data/speaker_segments/kjv_speaker_map.json` for red-letter spans, OpenBible topic and cross-reference tables for topical evidence and related passages, the Strong’s-tagged KJV files for all six catalogue books plus N1904 alignment for original-language connections, and the local Vine’s entry collection for lexical references.

Because the source red-letter formatting contains paragraph-boundary and divine-speaker ambiguities, `data/words-of-yeshua/speaker-overrides.json` documents exclusions, exact corrections, and every reviewed Acts/Revelation inclusion. The generator also rejects clearly non-Jesus speech and narration. `npm run content:check` protects known boundaries, but automated generation does not replace the required human editorial review in criterion 7.
