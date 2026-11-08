# I due file: la lista e il log

L'applicazione produce due file JSON, e sono due promesse fatte a una maestra, non formati interni:
un file che la maestra salva oggi deve riaprirsi fra un anno, su un altro telefono, senza
l'applicazione che l'ha scritto. Per questo hanno una decisione scritta, come l'URL del 0011.

## Decisione

**Entrambi i file sono JSON indentato, con i nomi dei campi in italiano e una `versione` in cima.**
La maestra apre il file col blocco note del telefono o con un editor: `tasti`, `bersagli`, `verdetto`,
`inizio_ms`. Il codice attorno resta in inglese, come in tutto il resto del repository; è il file che
parla italiano.

**La lista della maestra** è `{ "versione": 1, "tasti": [60, 62, 64] }`: numeri MIDI nell'ordine in cui
vanno chiesti. Un tasto che non è uno dei 88 del pianoforte viene rifiutato all'importazione e detto;
un file con una `versione` che l'applicazione non conosce viene rifiutato invece di essere interpretato
a metà. Si chiama `lista-della-maestra.json`.

**Il log della sessione** porta la prova in vigore, il soundcheck, la fine, il punteggio e i bersagli
con i colpi:

```json
{
  "versione": 1,
  "quando": "2026-11-08T22:30:11.000Z",
  "impostazioni": { "range": { "minimo": 48, "massimo": 72 }, "durata_secondi": 60,
                    "tempo_per_bersaglio_secondi": 8, "tetto_colpi": null,
                    "modalita": "casuale", "preset": null },
  "soundcheck": { "range_misurato": false, "range_effettivo": null, "nota": "…" },
  "fine": { "motivo": "tempo", "secondi": 60 },
  "punteggio": { "corrette": 12, "sbagliate": 3, "saltate": 2, "totale": 17, "note_al_minuto": 8.5 },
  "bersagli": [ { "tasto": 60, "nome": "Do4", "verdetto": "corretta", "millisecondi": 1234,
                  "inizio_ms": 0, "fine_ms": 1234, "colpi": [ { "altezza": 60, "ambiguo": false,
                  "credibilita": 9.2, "…": "…" } ] } ]
}
```

Si chiama `suona-la-nota-log-AAAA-MM-GG-HHMMSS.json`.

**Quello che non è stato misurato vale `null`, mai un numero plausibile.** Il soundcheck non esiste
ancora: `range_misurato` è `false` e `range_effettivo` è `null`, invece di lasciar passare il range
nominale per portata udibile. Quando il ticket 09 arriverà, il campo è già lì: conterrà l'intersezione
misurata e la nota cambierà di conseguenza.

**La `versione` si alza quando un campo cambia significato, non quando se ne aggiunge uno.** Aggiungere
un campo non rompe chi legge il vecchio; cambiare il senso di `verdetto` sì.

**Il verdetto si chiama però «corretta» dal ticket 14** (`docs/adr/0014`), e il campo `centrate` si
chiama `corrette`. La versione resta 1: il formato non era mai uscito dal repository, quindi il primo
file che qualcuno conserverà è già scritto così. Se un file di questo periodo circolasse con i nomi
vecchi, sarebbe indistinguibile — ma non è mai circolato.

**Il log c'è sempre, anche quando non è stato chiuso nessun bersaglio.** Una sessione brevissima può
finire col primo bersaglio ancora a schermo: i bersagli sono zero, ma impostazioni e punteggio sono
ancora l'evidenza che serve, e «nessun log» sarebbe la sola risposta illeggibile.

## Conseguenze

- Il log non è una statistica: i bersagli sono quelli chiusi, e quello ancora a schermo quando la
  sessione finisce non c'è, coi suoi colpi, come non entra nei conteggi (ADR 0003). In una sessione
  normale (un minuto, otto secondi per bersaglio) i bersagli chiusi ci sono sempre; il caso limite è
  una sessione di pochi secondi, che serve alla misura e non alla lezione.
- Un file prodotto da una versione futura non viene letto a metà: la lista lo rifiuta, il log non si
  importa affatto. Meglio un errore chiaro che un dato interpretato male.
- I nomi italiani sono una scelta di prodotto, non di stile: chi legge il file è la maestra, e
  `verdict` le manderebbe a cercare un dizionario.

## Alternative scartate

**YAML o CSV.** Il CSV appiattisce i colpi dentro il bersaglio; lo YAML aggiunge un parser e una
sensibilità all'indentazione per un file che nessuno scrive a mano.

**Nomi dei campi in inglese, come il codice.** Coerente col repository, incoerente con chi apre il file.

**Un formato interno senza `versione`, da cambiare quando serve.** Due file dello stesso nome con due
forme diverse sono il modo più rapido di perdere la fiducia di chi li conserva.

**Tenere i colpi del bersaglio a schermo in una sezione a parte.** Sarebbe più utile per la diagnosi,
ma introdurrebbe un bersaglio senza verdetto, cioè un quarto valore dove il glossario ne ha tre. Se il
soundcheck mostrerà che serve, sarà una decisione sua.
