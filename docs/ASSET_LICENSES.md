# Asset provenance and licensing

This document records the provenance and distribution conditions of non-code assets included in Outbreak Zones. It does not grant rights beyond those provided by each asset's applicable terms.

## Audio — `public/audio/`

The maintainer reports that all 12 WAV files in this directory were generated using the ElevenLabs Sound Effects tool: https://elevenlabs.io/app/sound-effects.

The README currently groups these as:
- Four gunfire variations.
- Four suspense/ambient variations.
- Four infected vocalizations.

**Known restriction: generated under the ElevenLabs Free plan (confirmed by the maintainer on 2026-11-11).** The Free plan does not include a commercial license; its outputs are for personal/non-commercial use only. ElevenLabs also requires attribution when Free-plan output is shared non-commercially. Therefore, these WAV files are **not cleared for commercial distribution or monetized use** in the current state of the project.

Before a commercial release, replace these files with audio whose license permits the intended use, or obtain a valid commercial license that explicitly covers these already-generated outputs. Do not assume upgrading later retroactively grants commercial rights to outputs generated while on the Free plan; obtain written confirmation from ElevenLabs if considering that route.

For non-commercial sharing, follow the attribution requirement in the ElevenLabs agreement applicable to the account and generation date. Keep the generation records and prompts where possible. Also ensure the WAV files are distributed only as integrated game audio, not as a standalone sound-effects library.

Do not describe these WAV files as MIT-licensed. The repository's MIT license applies to the project's original code, not automatically to audio or other third-party/generated assets.

## Other assets

Inventory and verify the provenance and license of all other image, sprite, tile, font, and audio assets before release. Record the source, author/generator, license/terms, and any required attribution for each asset or asset group.

## Review record

- 2026-11-11: Maintainer confirmed the 12 WAV files were generated with ElevenLabs Sound Effects on the Free plan. Commercial-use clearance is not available under that plan.
