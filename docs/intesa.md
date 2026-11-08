# L'intesa

Una pagina sola. Se è questa, l'esercizio si scrive; se non è questa, il punto sbagliato si vede qui
e non fra mille righe.

## Cosa fa

Un ragazzo di 10-13 anni legge una nota sul pentagramma e la suona. Un telefono ascolta il pianoforte
dal microfono, decide se il tasto premuto è quello giusto, e passa alla nota dopo quando lo è o
quando il tempo è scaduto. Alla fine un punteggio: corrette, sbagliate, saltate.

Niente tastiera sullo schermo (la mappa rigo→tasto è il compito), niente suono di riferimento durante
l'esercizio, niente backend, niente dati che escono dal dispositivo.

## Le parole

- **Bersaglio** — la nota scritta da eseguire. **Tasto** — quello che si preme, un numero MIDI.
- **Colpo** — un attacco riconosciuto dal microfono, con l'altezza che contiene.
- **Colpo ambiguo** — un colpo in cui la nota e la sua ottava restano indistinguibili: pareggio entro
  3 dB *e* evidenza delle parziali dispari dentro la banda 0,2–0,4, oppure evidenza non calcolabile.
  Non si giudica, si chiede di ripetere, e non costa un tentativo.
- **Verdetto** — corretta, sbagliata, saltata. Tre valori, non due.

## I numeri

|                    |                                                                            |
|--------------------|----------------------------------------------------------------------------|
| durata sessione    | 60 s, configurabile; la pausa non conta                                    |
| per bersaglio      | 8 s; colpi liberi fino allo scadere; tetto ai colpi configurabile e spento |
| range base         | Do3–Do5 (48–72)                                                            |
| range avanzato     | Si1–Re6 (35–86)                                                            |
| chiavi             | entrambe nella stessa sessione, di default                                 |
| chiave di una nota | quella che la lascia più vicina al rigo; il Do centrale alterna            |
| tagli addizionali  | si disegnano, senza avvisi                                                 |
| sequenza           | casuale senza ripetizioni, preset, lista della maestra (editor + JSON)     |
| schermate          | avvio con soundcheck, scelta, esercizio, riepilogo                         |
| classifica         | locale, nickname facoltativo                                               |
| distribuzione      | PWA installabile, funzionante offline, cartella statica                    |

## L'ascolto

Solo microfono: il pianoforte acustico e iPad escludono il MIDI, e il caso d'uso è quello.

- due finestre: **2048 campioni** per l'attacco, **16384** (341 ms) per l'altezza;
- l'attacco è un **isteresi** (un colpo per salita), non un cooldown;
- l'altezza si legge **150 ms dopo** l'attacco, quando la finestra lunga si è riempita;
- la ricerca è limitata al **range dell'esercizio**, mai tutti gli 88 tasti;
- un colpo entra solo se la nota vince **≥ 4 volte** sulla mediana dei candidati (credibilità: numero
  puro, non dipende dal volume del telefono);
- l'ottava si decide con le **parziali dispari** dell'ottava sotto: una corda premuta le ha, una che
  risuona no (0,32–0,60 contro ≤ 0,21, misurato);
- se l'evidenza cade nella banda **0,2–0,4** — o non è calcolabile — il colpo è ambiguo: non si
  giudica, si chiede di ripetere;
- il **soundcheck** misura il compasso e la portata udibile del dispositivo, e può solo restringere i
  range.

## Cosa sappiamo, misurato

Su un mezza coda Yamaha, coperchio chiuso, telefono Android di fascia media, microfono del telefono:

| registro       | come va                                              |
|----------------|------------------------------------------------------|
| sotto Mi2      | inutilizzabile (14-17%): lo esclude il soundcheck    |
| Mi2–Si2        | 85-95%                                               |
| Do3–Do5 (base) | 84% severo, **92%** contando a parte i colpi ambigui |
| Do#5–Re6       | 85-100%                                              |

Nessuna nota inventata fuori dal range; colpi duplicati scesi dal 11% all'1-3%; frequenza misurata
registrata per ogni colpo, così un errore del rilevatore si distingue da un errore dell'allievo.

## Cosa non sappiamo

- **L'ottava** è decisa dalle parziali dispari su una sessantina di colpi di un solo strumento: è il
  criterio migliore che abbiamo, non una certezza. La sonda del tempo di salita
  (`/spike/salita.html`) non discrimina e resta nel repository come negativo documentato.
- **Verticale e tastiera elettronica**: mai misurati. La previsione è "acuti meglio, grave peggio"
  sulle elettroniche.
- Il dominio di pubblicazione.

## Le decisioni

`docs/adr/0001` microfono e basta · `0002` PWA statica, classifica locale · `0003` la matrice dei
verdetti · `0004` il rilevatore dopo il primo giro · `0005` la parabola e la risonanza · `0006`
leggere dopo l'attacco · `0007` il quarto giro · `0008` il colpo ambiguo · `0009` le parziali
dispari.

Le specifiche complete: `docs/spec-esercizio.md`. I giri di misura e le loro condizioni:
`docs/protocollo-di-misura.md`.
