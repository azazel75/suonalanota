# Le proporzioni del rigo

Emilia, che insegna e legge gli spartiti per mestiere, ha guardato l'esercizio sul telefono e ha
detto due cose: le chiavi sono troppo piccole, e le note anche — l'altezza di una testa di nota
dovrebbe valere la distanza fra due righe del pentagramma. Aveva ragione, e non era una questione di
gusto: misurando il disegno, le proporzioni erano sbagliate di un fattore tre.

## Il difetto

VexFlow disegna ogni glifo con una dimensione **fissa**, 30 pt (40 px), calibrata sul **suo** spazio di
pentagramma di 10 px. L'applicazione, per farsi leggere da un telefono, ha ingrandito il pentagramma a
uno spazio di **30 unità** — e i glifi sono rimasti a quella misura. Il risultato, misurato sul SVG
vero a 390×844:

| grandezza | prima | in spazi di pentagramma | dovrebbe essere |
| --- | --- | --- | --- |
| testa della nota | 10 unità | 0,33 | 1 |
| chiave di violino | 71 unità | 2,4 | 7,1 |
| spessore delle righe | 1 unità | 0,03 | 0,1 |

Il pentagramma era cresciuto e le note no: il contrario di quello che serve a chi legge.

## La regola

SMuFL, lo standard dei font musicali (*Metrics and glyph registration*):

> «Dividing the em in four provides an analogue for a five-line staff: if a font uses 1000 upm, as is
> conventional for a PostScript font, one staff space is equal to 250 design units» · «All glyphs
> should be drawn at a scale consistent with the key measurement that one staff space = 0.25 em».

Cioè: **il font si deriva dallo spazio**, quattro spazi per em. Coi numeri di Bravura (misurati sul
font, non stimati): la testa di nota è 0,26 em, la chiave di violino 1,77 em (7,08 spazi), la chiave di
basso 0,91 em (3,64 spazi).

## Decisione

- **La testa della nota** è disegnata con un em di **4,2 spazi**: la testa viene **1,05 spazi** alta,
  leggermente più piena dello spazio esatto, come ha chiesto Emilia.
- **Le chiavi** con un em di **4 spazi**: la chiave di violino viene **7,08 spazi**, la sua altezza
  incisa; quella di basso 3,64, che è la sua. Nessuna delle due è rimpicciolita «per stare nel rigo».
- **Le righe** hanno lo spessore che VexFlow usa al suo spazio: **0,1 spazi** (3 unità su 30), e i
  tagli addizionali 0,2. Prima erano un pelo da 1 unità, invisibile su un telefono.
- **Il foglio riserva lo spazio della chiave**, che è più alta del rigo: 1,4 spazi sopra e 1,7 sotto
  per la chiave di violino, 0,1 e 0 sopra per quella di basso. I fogli del riepilogo, calcolati solo
  sulle note, erano alti 5,5 spazi e avrebbero tagliato la chiave: ora partono da 7,5.
- La dimensione del glifo si legge dallo spazio, mai dal foglio: `noteheadFontPt(spacing)` e
  `clefFontPt(spacing)` in `src/score/layout.ts`, applicate in `src/score/sheet.ts` alla chiave, alle
  teste e agli accidentali.

## Conseguenze

Su un telefono da 390 px lo spazio resta 24 px — la dimensione che rende leggibile il rigo — ma la
testa della nota passa da **8 a 26 px** di altezza e la chiave di violino da **57 a 170 px**. Il rigo
ora sembra uno spartito: righe visibili, note piene, chiave alta quanto deve.

I fogli del riepilogo diventano più alti (168 unità invece di 122) perché devono contenere la chiave:
la classifica delle note da rivedere scorre un po' di più, ed è il prezzo giusto.

## Alternative scartate

**Rimpicciolire il foglio ai 10 px di VexFlow e lasciare che sia il CSS a ingrandirlo** (il `viewBox`
lo permette): avrebbe dato le stesse proporzioni senza toccare i glifi, ma tutti i numeri della
geometria (larghezze delle serie, margine, tetto del riepilogo) sarebbero cambiati di scala, e il
foglio avrebbe smesso di essere misurabile in unità leggibili. La dimensione del glifo è una proprietà
del rigo, non del foglio: meglio dirla dove si legge.

**Chiave a due terzi**, come nelle edizioni economiche: sotto lo standard, e la chiave è metà della
lettura.

**Testa di nota a 1,00 spazio esatto**: possibile in un minuto cambiando `NOTEHEAD_EM_SPACES` a 4; la
versione «un pelo più piena» è quella scelta.

## Verifica

- `tests/layout.test.ts`: il font della chiave vale VexFlow ai suoi 10 px, scala con lo spazio, la
  testa è un ventesimo più alta dello spazio; per ogni tasto dei due intervalli la chiave sta nel
  foglio; un foglio di serie non scende sotto i 7,5 spazi.
- Nel browser, sull'inchiostro vero del font (non sulle scatole del testo): testa **1,067 spazi**,
  chiave di violino **7,07**, chiave di basso **3,60**, righe **0,1 spazi**. 118 controlli, due volte.
