# suona-la-nota

Esercizi di lettura del pentagramma per ragazzi di 10-13 anni: l'applicazione mostra una nota alla
volta, in chiave di violino e di basso, ascolta il pianoforte dal microfono e passa alla nota
successiva quando sente il tasto giusto o quando scade il tempo. Alla fine dà il punteggio:
quante centrate, quante sbagliate, quante saltate.

**Stato: la prova e il riepilogo.** La pagina è un wizard: prima si sceglie la prova — range con
minimo e massimo, durata, tempo per bersaglio, tetto ai colpi, sequenza casuale, da preset o dalla
lista della maestra — e solo dopo compare il rigo. Il rigo mostra un bersaglio alla volta, nella chiave
che lascia la nota più vicina al rigo, ascolta il pianoforte dal microfono e risponde subito: verde
sulla nota giusta, rosso sulla sbagliata, e quando l'ottava è incerta non giudica — chiede di
ripetere. Otto secondi per bersaglio, pausa, e la sessione che si chiude da sola a tempo scaduto o a
lista esaurita. A fine sessione i tre conteggi, le note al minuto e le note da rivedere, scritte sul
rigo con la loro chiave. La lista della maestra si compone toccando i tasti di una tastiera, si esporta
e si importa come file JSON, e resta sul telefono fra una lezione e l'altra.
Mancano il soundcheck, la classifica e la PWA offline.

## La prova si può dettare dall'URL

Un link può impostare la prova al posto della schermata di configurazione, che in quel caso non
compare; i parametri che non ci sono restano ai default.

| parametro | valori | default |
| --- | --- | --- |
| `range` | `base` (Do3–Do5), `advanced` (Si1–Re6) | `base` |
| `lowest`, `highest` | numero MIDI, estremi inclusi; correggono il preset | Do3, Do5 |
| `duration` | secondi di sessione | `60` |
| `timeout` | secondi per bersaglio | `8` |
| `cap` | colpi errati che chiudono un bersaglio; assente o minore di 1 = nessun tetto | assente |
| `mode` | `random`, `preset`, `list` | `random` |
| `preset` | `prime-note`, `rigo-di-basso`, `due-chiavi`; un id che non esiste ricade su `prime-note` | `prime-note` |

```text
https://…/?range=advanced&duration=120&timeout=6
https://…/?mode=preset&preset=due-chiavi&duration=90
```

Un link non fa partire la sessione: il microfono vuole un gesto, quindi si atterra sul rigo con
«Inizia» davanti. `?autostart=1` è l'eccezione, ed è una scorciatoia di misura per un browser senza
testa con un microfono finto; salta anche la configurazione. Le decisioni stanno in
[0011](docs/adr/0011-la-prova-dettata-dall-url.md).

## La lista della maestra

Con la modalità `list` la prova chiede i tasti che la maestra ha scelto, nell'ordine in cui li ha
toccati. La tastiera mostra un'ottava per riga — sette tasti bianchi di fila, i neri sopra le fessure —
perché a 390 px un dito trova ancora il tasto; un tasto scelto porta il numero del suo posto.

La lista resta sul telefono (`localStorage`, chiave `suona-la-nota.lista`): sopravvive a un
ricaricamento e alla chiusura del browser, ma non passa a un altro telefono — per quello c'è il file.
«Esporta la lista» scarica `lista-della-maestra.json`; «Importa una lista» rilegge lo stesso formato:

```json
{
  "versione": 1,
  "tasti": [60, 62, 64]
}
```

`tasti` sono numeri MIDI, nell'ordine in cui vanno chiesti. Un tasto fuori dai 88 del pianoforte
(21–108) viene segnalato e lasciato fuori; un file che non è quello — un altro JSON, o una versione che
l'applicazione non conosce — viene rifiutato con una frase in italiano, e la lista di prima resta. I
tasti della lista fuori dal range attivo restano nella lista ma non vengono chiesti: una riga sotto la
tastiera dice quanti sono.

## Il log della sessione

A fine sessione il riepilogo offre **«Scarica il log»**: un file JSON indentato, con i nomi dei campi
in italiano, che si apre e si legge senza strumenti. Si chiama
`suona-la-nota-log-AAAA-MM-GG-HHMMSS.json` e contiene:

- le **impostazioni in vigore** (range, durata, tempo per bersaglio, tetto, modalità, preset);
- i **bersagli** che la sessione ha chiesto, in ordine, col tasto, il nome, il verdetto, i millisecondi
  e i **colpi** sentiti mentre quel bersaglio era a schermo: altezza, frequenza, credibilità, livello,
  margini sul secondo classificato e sull'ottava, stabilità, istante;
- il **soundcheck**: oggi `range_misurato: false` e `range_effettivo: null`, perché il soundcheck non
  c'è ancora — il file dice che il range non è stato misurato invece di fingere che lo sia. Quando il
  soundcheck arriverà, `range_effettivo` conterrà il range misurato;
- la **fine** (tempo scaduto o lista esaurita) e il **punteggio**.

Un colpo che il rilevatore non ha potuto giudicare è segnato `ambiguo: true` e non conta come errore.
Quello che non è stato misurato vale `null`, mai un numero inventato. Il bersaglio ancora a schermo
quando la sessione finisce non entra nel log, come non entra nei conteggi (ADR 0003). Il log c'è anche
quando la sessione non ha chiuso nessun bersaglio: impostazioni e punteggio sono ancora evidenza. I due
formati sono decisi in [0012](docs/adr/0012-i-due-file.md).

## Come si lavora

```sh
just install     # npm install, una volta sola
just check       # tipi, test, build
just dev         # server di sviluppo su http://localhost:5173
```

Ogni ricetta entra nel devShell di `flake.nix` (flake-parts, Node 22): non serve niente installato
sul sistema.

```sh
nix develop      # la shell, se la vuoi interattiva
```

## Il pacchetto da pubblicare

```sh
just package     # nix build .# — la cartella `result/` è quella da copiare sul server
```

Le dipendenze JavaScript sono fissate da `package-lock.json` attraverso `npmDepsHash`: il build non
usa la rete, e lo stesso `flake.lock` produce la stessa cartella. `just check-nix` (`nix flake check`)
esegue i test e il controllo dei tipi dentro il sandbox, sulle stesse dipendenze del pacchetto.

Il pacchetto contiene esattamente ciò che si serve: `index.html`, `assets/` e le tre pagine di
`spike/`. Non contiene sorgenti né `node_modules`.

## Lo spike dell'ascolto

`spike/ascolto.html` è uno strumento di misura, non un pezzo di prodotto. Suona una nota con il
pianoforte e mostra:

- che nota ha riconosciuto, con che margine sul secondo classificato e sull'ottava;
- lo spettro, con sopra le righe verdi delle prime otto parziali della nota di riferimento: se la
  riga della fondamentale non c'è, il microfono non la sta sentendo;
- i primi cinque candidati con i punteggi;
- i conteggi per nota di riferimento: giusti, ottave sbagliate, altre note. È questa tabella che
  dice fin dove arriva la portata udibile del dispositivo.

Il pulsante **Scarica log JSON** produce l'evidenza su cui si giudica lo spike: dispositivo,
campionamento, vincoli applicati davvero dal browser, ogni colpo con l'altezza rilevata e i
margini, e il rumore misurato nella stanza.

### Aprirlo dal telefono

Il microfono esiste solo in un contesto sicuro: `http://192.168.x.y` non lo è, `https://` sì.

```sh
just serve-tls
```

Compila `dist/`, genera un certificato usa-e-getta con openssl (valido per localhost e per gli
indirizzi IPv4 della macchina) e stampa gli indirizzi da aprire sul telefono. Il browser avviserà
che il certificato non è firmato: va accettato una volta. **La porta risponde solo in HTTPS**:
aprire `http://…:8443` non dà nessuna risposta, ed è il primo sospetto quando "non si vede niente".
Se la porta è occupata, il server lo dice e suggerisce `PORT=8444 just serve-tls`. Con un
certificato non fidato Safari su iOS può comunque rifiutare il microfono; in quel caso la strada
rapida è Chrome su Android con `chrome://flags/#unsafely-treat-insecure-origin-as-secure` puntato
sull'indirizzo http.

### Cosa guardare

| Domanda | Dove si legge |
| --- | --- |
| Il telefono sente la nota? | la riga della fondamentale nello spettro, e il livello in dBFS |
| Il telefono sbaglia l'ottava? | la colonna "ottave" della tabella per riferimento, e il margine ottava |
| Da che nota in su funziona? | la tabella per riferimento: la riga più grave con soli "giusti" |
| La stanza è troppo rumorosa? | il pulsante "Misura il rumore della stanza": un picco a 100 Hz è il ronzio di rete |

Criteri di accettazione fissati prima di misurare: precisione ≥ 95% sulle note singole fra C3 e C6,
≤ 5% di errori di ottava, < 2% di falsi positivi su 60 s di stanza silenziosa, latenza
attacco → verdetto < 400 ms. Il registro grave (A0-B2) si misura e si riporta, senza soglia.

## Cosa è già deciso

- [CONTEXT.md](CONTEXT.md) — il glossario: bersaglio, colpo, verdetto, portata udibile.
- [0001](docs/adr/0001-ascolto-solo-microfono.md) — solo microfono, niente MIDI.
- [0002](docs/adr/0002-pwa-statica-senza-backend.md) — PWA statica, classifica sul dispositivo.
- [0003](docs/adr/0003-verdetto-per-modo-di-avanzamento.md) — centrata / sbagliata / saltata.
- [0004](docs/adr/0004-rilevatore-dopo-il-primo-spike.md) — il rilevatore dopo il primo spike.
- [0005](docs/adr/0005-la-parabola-e-la-risonanza.md) — la parabola e la risonanza.
- [0006](docs/adr/0006-leggere-dopo-l-attacco.md) — leggere dopo l'attacco.
- [0007](docs/adr/0007-il-quarto-giro.md) — il quarto giro di misura.
- [0008](docs/adr/0008-il-colpo-ambiguo.md) — il colpo ambiguo non si giudica.
- [0009](docs/adr/0009-le-parziali-dispari.md) — le parziali dispari e l'ottava.
- [0010](docs/adr/0010-il-feedback-e-il-silenzio.md) — il feedback, il silenzio, la pausa.
- [0011](docs/adr/0011-la-prova-dettata-dall-url.md) — il wizard della prova e l'URL che lo salta.
- [0012](docs/adr/0012-i-due-file.md) — i due file JSON: la lista della maestra e il log.

## Cosa non è ancora verificato

- **L'acustica.** I test coprono l'aritmetica del rilevatore su segnali sintetici. Nessun pianoforte
  vero è ancora passato dal microfono di un telefono vero: è esattamente ciò che lo spike deve
  misurare, e finché non è misurato non ci sono stime di tempi.
- **Il rigo in mano a un ragazzo.** La grafica è verificata in un browser senza testa a 390×844: non
  su un telefono vero, alla luce di una stanza, con le dita di chi suona.

## Com'è fatto il repository

```
src/audio/      il rilevatore: FFT, somma armonica, attacchi; microfono e tono (senza logica)
src/exercise/   il motore dell'esercizio, il riepilogo, le impostazioni e la lista della maestra (senza DOM)
src/score/      la mappa tasto → rigo, la geometria del foglio, VexFlow
src/session/    la macchina a stati della sessione e il log scaricabile (senza DOM né audio)
src/spike/      la pagina di misura
tests/          i test del rilevatore, del motore, della mappa, della prova, della lista e del log
scripts/        serve-tls.mjs, il server https usa-e-getta per il telefono
docs/adr/       le decisioni
```

Licenza: GNU GPL v3 o successiva.
