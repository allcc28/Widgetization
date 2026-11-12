# Credits

## Portraits

The character portraits are **AI-generated images by WarheadDnC**, from the free asset pack
"385 Free Fantasy Portraits" on itch.io (https://warheaddnc.itch.io/385-fantasy-portraits).
The pack page states that the images are AI-generated (512x768 PNG; humans, elves, dwarves,
orcs, tieflings, undead and more).

**Terms stated on the pack page (read on 2026-11-12):** "Free for Personal & Commercial
Use"; "No attribution required, but credit is always appreciated." The page does not
mention redistribution or modification. Because it is silent, we keep the repository
**private** and do not publish the image files separately; we credit the author anyway.

Modification: each image was downscaled to 400 px wide and saved as JPEG
(`src/client/assets/portraits/<class>.jpg`). The app crops it to fit the card.
Originals stay out of git (`Portraits_incoming/` is in `.gitignore`).

| Class | Source file (in `Portraits_incoming/`) |
|---|---|
| Ranger | 00123-3443929797.png |
| Berserker | 00102-434289067.png |
| Cleric | 00146-630330069.png |
| Mage | 00175-647316307.png |
| Rogue | 00152-630330075.png |
| Paladin | 00085-2559227711.png |
| Bard | 00180-647316312.png |
| Druid | 00148-630330071.png |

The portraits are static and chosen by class; the model never sees or generates them.
The app also shows a short credit line at the bottom of the page. If a portrait is
replaced, update this table and that line.

## Previous icons

Earlier versions used icons from [Game-icons.net](https://game-icons.net) (CC BY 3.0) and
another itch.io pack. Neither is in the project now, so no attribution to them is needed.

## Fonts

Cinzel (headings), via the `@fontsource/cinzel` package, SIL Open Font License 1.1.
