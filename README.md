# suona-la-nota

Esercizi di lettura del pentagramma per ragazzə di 10-13 anni: l'applicazione
mostra una nota alla volta, in chiave di violino e di basso, ascolta il
pianoforte dal microfono e passa alla nota successiva quando sente il tasto
giusto o quando scade il tempo. Alla fine dà il punteggio: quante corrette,
quante sbagliate, quante saltate.

**Stato: la prova e il riepilogo.** La pagina è un wizard: prima si sceglie la
prova — intervallo con minimo e massimo, durata, tempo per nota, numero massimo
di tentativi, sequenza casuale, da una lista predefinita o dalla lista
dell'insegnante — e solo dopo compare il rigo. Il rigo mostra una nota alla
volta, nella chiave che lascia la nota più vicina al rigo, ascolta il pianoforte
dal microfono e risponde subito: verde sulla nota giusta, rosso sulla sbagliata,
e quando l'ottava è incerta non giudica — chiede di ripetere. Otto secondi per
nota, pausa, e la sessione che si chiude da sola a tempo scaduto o a lista
esaurita. A fine sessione i tre conteggi, le note al minuto e le note da
rivedere, scritte sul rigo con la loro chiave; poi il nome, una riga per ragazzə
nella classifica della prova, e la posizione anche quando è sotto le prime
cinque. La lista dell'insegnante si compone toccando i tasti di una tastiera, si
esporta e si importa come file JSON, e resta sul telefono fra una lezione e
l'altra. L'applicazione si installa e funziona senza rete: manifest e service
worker escono dal build, e il guscio che si apre in classe è quello dell'ultima
visita; quando il guscio cambia, l'app lo dice con una barra e si aggiorna al
tocco, mai a metà esercizio (ADR 0020). Il **soundcheck** — cinque note per
misurare che cosa il telefono sente
davvero — si fa a richiesta dalla configurazione, e la misura resta sul telefono
finché non si rifà: chi apre l'applicazione per suonare non ci passa davanti.

## Come si avvia

`nix run` costruisce `dist/` dalla working tree e la serve in **HTTPS su tutte le
interfacce** — porta 8443, o `PORT` — poi apre la pagina nel browser:

    nix run .

È https perché un telefono concede il microfono solo in un contesto sicuro:
`http://192.168.x.y` non lo è. Il certificato è autofirmato, il browser avvisa una
volta per dispositivo; `OPEN=0 nix run .` serve la pagina senza aprirla, e
`PORT=9443 nix run .` cambia la porta. Va lanciato dalla radice del repository (usa
`node_modules`: la prima volta serve `just install`), ed è lo stesso server di
`just serve-tls`, che resta comodo quando si è già dentro la dev shell.

Per lavorare invece c'è `just dev`: vite, ricarica automatica, nessun service
worker, microfono sì perché `localhost` è un contesto sicuro. `checks.serve`
avvia il server su una porta di loopback e gli chiede la pagina in TLS, perché un
server che parte e non serve niente è proprio il guasto da vedere.

## La prova si può dettare dall'URL

Un link può impostare la prova al posto della schermata di configurazione, che
in quel caso non compare; i parametri che non ci sono restano ai default.

| parametro           | valori                                                                                      | default      |
|---------------------|---------------------------------------------------------------------------------------------|--------------|
| `range`             | `base` (Do3–Do5), `advanced` (Si1–Re6)                                                      | `base`       |
| `lowest`, `highest` | numero MIDI, estremi inclusi; correggono l'intervallo scelto                                | Do3, Do5     |
| `duration`          | secondi di durata dell'esercizio                                                            | `60`         |
| `timeout`           | secondi per nota                                                                            | `8`          |
| `cap`               | tentativi dopo i quali si passa alla nota successiva; assente o minore di 1 = nessun limite | assente      |
| `mode`              | `random`, `preset`, `list`                                                                  | `random`     |
| `preset`            | `prime-note`, `rigo-di-basso`, `due-chiavi`; un id che non esiste ricade su `prime-note`    | `prime-note` |
| `soundcheck`        | `1` fa passare dalla misura della sensibilità prima della prova                             | assente      |

`soundcheck` non è un parametro della prova: non fa saltare la configurazione,
la apre, e la misura viene prima di tutto il resto. Venendo da un link che lo
impone, se una misura c'è già la schermata la offre; se la misura non riesce,
l'unica uscita senza portata è il bottone «Continua senza misurare». Con
`soundcheck=1`, `autostart` non fa partire la sessione da solo: il gesto che
apre il microfono è il bottone della misura.

```text
https://…/?range=advanced&duration=120&timeout=6
https://…/?mode=preset&preset=due-chiavi&duration=90
```

Un link non fa partire la sessione: il microfono vuole un gesto, quindi si
atterra sul rigo con «Inizia» davanti. `?autostart=1` è l'eccezione, ed è una
scorciatoia di misura per un browser senza testa con un microfono finto; salta
anche la configurazione. Le decisioni stanno in
[0011](docs/adr/0011-la-prova-dettata-dall-url.md).

## La lista dell'insegnante

Con la modalità `list` la prova chiede i tasti che l'insegnante ha scelto,
nell'ordine in cui li ha toccati. La tastiera mostra un'ottava per riga — sette
tasti bianchi di fila, i neri sopra le fessure — perché a 390 px un dito trova
ancora il tasto; un tasto scelto porta il numero del suo posto.

La lista resta sul telefono (`localStorage`, chiave `suona-la-nota.lista`):
sopravvive a un ricaricamento e alla chiusura del browser, ma non passa a un
altro telefono — per quello c'è il file. «Esporta la lista» scarica
`lista-dell-insegnante.json`; «Importa una lista» rilegge lo stesso formato:

```json
{
  "versione": 1,
  "tasti": [60, 62, 64]
}
```

`tasti` sono numeri MIDI, nell'ordine in cui vanno chiesti. Un tasto fuori dai
88 del pianoforte (21–108) viene segnalato e lasciato fuori; un file che non è
quello — un altro JSON, o una versione che l'applicazione non conosce — viene
rifiutato con una frase in italiano, e la lista di prima resta. I tasti della
lista fuori dall'intervallo attivo restano nella lista ma non vengono chiesti:
una riga sotto la tastiera dice quanti sono.

## Il log della sessione

A fine sessione il riepilogo offre **«Scarica il log»**: un file JSON indentato,
con i nomi dei campi in italiano, che si apre e si legge senza strumenti. Si
chiama `suona-la-nota-log-AAAA-MM-GG-HHMMSS.json` e contiene:

- le **impostazioni in vigore** (intervallo, durata, tempo per nota, numero
  massimo di tentativi, modalità, lista predefinita);
- le **note** che la sessione ha chiesto, in ordine, col tasto, il nome, il
  verdetto, i millisecondi e le **pressioni** sentite mentre quella nota era a
  schermo: altezza, frequenza, credibilità, livello, margini sul secondo
  classificato e sull'ottava, stabilità, istante;
- il **soundcheck**: `intervallo_misurato: false` e `intervallo_effettivo: null`
  quando non è stato fatto — il file dice che l'intervallo non è stato misurato
  invece di fingere che lo sia — e `intervallo_misurato: true` con
  l'intersezione quando c'è;
- la **fine** (tempo scaduto o lista esaurita) e il **punteggio**.

Una pressione che il rilevatore non ha potuto giudicare è segnata `ambiguo:
true` e non conta come errore. Quello che non è stato misurato vale `null`, mai
un numero inventato. La nota ancora a schermo quando la sessione finisce non
entra nel log, come non entra nei conteggi (ADR 0003). Il log c'è anche quando
la sessione non ha chiuso nessuna nota: impostazioni e punteggio sono ancora
evidenza. I due formati sono decisi in [0012](docs/adr/0012-i-due-file.md).

## Come si lavora

```sh
just install     # npm install, una volta sola
just check       # tipi, test, build
just dev         # server di sviluppo su http://localhost:5173
```

Ogni ricetta entra nel devShell di `flake.nix` (flake-parts, Node 22): non serve
niente installato sul sistema.

```sh
nix develop      # la shell, se la vuoi interattiva
```

## Il pacchetto da pubblicare

```sh
just package     # nix build .# — la cartella `result/` è quella da copiare sul server
```

Le dipendenze JavaScript sono fissate da `package-lock.json` attraverso
`npmDepsHash`: il build non usa la rete, e lo stesso `flake.lock` produce la
stessa cartella. `just check-nix` (`nix flake check`) esegue i test e il
controllo dei tipi dentro il sandbox, sulle stesse dipendenze del pacchetto.

Il pacchetto contiene esattamente ciò che si serve: `index.html`, `assets/` e le
tre pagine di `spike/`. Non contiene sorgenti né `node_modules`.

## Lo spike del microfono

`spike/ascolto.html` è uno strumento di misura, non un pezzo di prodotto. Suona
una nota con il pianoforte e mostra:

- che nota ha riconosciuto, con che margine sul secondo classificato e
  sull'ottava;
- lo spettro, con sopra le righe verdi delle prime otto parziali della nota di
  riferimento: se la riga della fondamentale non c'è, il microfono non la sta
  sentendo;
- i primi cinque candidati con i punteggi;
- i conteggi per nota di riferimento: giusti, ottave sbagliate, altre note. È
  questa tabella che dice fin dove arriva la portata udibile del dispositivo.

Il pulsante **Scarica log JSON** produce l'evidenza su cui si giudica lo spike:
dispositivo, campionamento, vincoli applicati davvero dal browser, ogni
pressione con l'altezza rilevata e i margini, e il rumore misurato nella stanza.

### Aprirlo dal telefono

Il microfono esiste solo in un contesto sicuro: `http://192.168.x.y` non lo è,
`https://` sì.

```sh
just serve-tls
```

Compila `dist/`, genera un certificato usa-e-getta con openssl (valido per
localhost e per gli indirizzi IPv4 della macchina) e stampa gli indirizzi da
aprire sul telefono. Il browser avviserà che il certificato non è firmato: va
accettato una volta. **La porta risponde solo in HTTPS**: aprire `http://…:8443`
non dà nessuna risposta, ed è il primo sospetto quando "non si vede niente". Se
la porta è occupata, il server lo dice e suggerisce `PORT=8444 just serve-tls`.
Con un certificato non fidato Safari su iOS può comunque rifiutare il microfono;
in quel caso la strada rapida è Chrome su Android con
`chrome://flags/#unsafely-treat-insecure-origin-as-secure` puntato
sull'indirizzo http.

### Cosa guardare

| Domanda                       | Dove si legge                                                                      |
|-------------------------------|------------------------------------------------------------------------------------|
| Il telefono sente la nota?    | la riga della fondamentale nello spettro, e il livello in dBFS                     |
| Il telefono sbaglia l'ottava? | la colonna "ottave" della tabella per riferimento, e il margine ottava             |
| Da che nota in su funziona?   | la tabella per riferimento: la riga più grave con soli "giusti"                    |
| La stanza è troppo rumorosa?  | il pulsante "Misura il rumore della stanza": un picco a 100 Hz è il ronzio di rete |

Criteri di accettazione fissati prima di misurare: precisione ≥ 95% sulle note
singole fra C3 e C6, ≤ 5% di errori di ottava, < 2% di falsi positivi su 60 s di
stanza silenziosa, latenza attacco → verdetto < 400 ms. Il registro grave
(A0-B2) si misura e si riporta, senza soglia.

## Cosa è già deciso

- [CONTEXT.md](CONTEXT.md) — il glossario: nota, pressione, tentativo, verdetto,
  portata udibile.
- [0001](docs/adr/0001-ascolto-solo-microfono.md) — solo microfono, niente MIDI.
- [0002](docs/adr/0002-pwa-statica-senza-backend.md) — PWA statica, classifica
  sul dispositivo.
- [0003](docs/adr/0003-verdetto-per-modo-di-avanzamento.md) — i tre verdetti
  (oggi: corretta / sbagliata / saltata).
- [0004](docs/adr/0004-rilevatore-dopo-il-primo-spike.md) — il rilevatore dopo
  il primo spike.
- [0005](docs/adr/0005-la-parabola-e-la-risonanza.md) — la parabola e la
  risonanza.
- [0006](docs/adr/0006-leggere-dopo-l-attacco.md) — leggere dopo l'attacco.
- [0007](docs/adr/0007-il-quarto-giro.md) — il quarto giro di misura.
- [0008](docs/adr/0008-il-colpo-ambiguo.md) — il colpo ambiguo non si giudica.
- [0009](docs/adr/0009-le-parziali-dispari.md) — le parziali dispari e l'ottava.
- [0010](docs/adr/0010-il-feedback-e-il-silenzio.md) — il feedback, il silenzio,
  la pausa.
- [0011](docs/adr/0011-la-prova-dettata-dall-url.md) — il wizard della prova e
  l'URL che lo salta.
- [0012](docs/adr/0012-i-due-file.md) — i due file JSON: la lista
  dell'insegnante e il log.
- [0013](docs/adr/0013-le-schermate-come-moduli.md) — una schermata, un modulo.
- [0014](docs/adr/0014-il-verdetto-si-chiama-corretta.md) — il verdetto si
  chiama «corretta».
- [0015](docs/adr/0015-la-classifica-locale.md) — la classifica del telefono,
  una riga per ragazzə.
- [0016](docs/adr/0016-il-guscio-offline.md) — manifest e service worker emessi
  dal build.
- [0017](docs/adr/0017-il-soundcheck.md) — il soundcheck: un passo a richiesta,
  non un cancello.
- [0018](docs/adr/0018-le-parole-dell-esercizio.md) — le parole dell'esercizio:
  la nota, la pressione, il tentativo.
- [0019](docs/adr/0019-le-proporzioni-del-rigo.md) — le proporzioni del rigo:
  il font segue lo spazio.
- [0020](docs/adr/0020-il-guscio-si-aggiorna.md) — il guscio si aggiorna quando
  l'utente dice sì.

## Cosa non è ancora verificato

- **L'acustica in una lezione vera.** Il rilevatore è stato misurato su un
  pianoforte vero (`docs/protocollo-di-misura.md`, giri 1–7); l'esercizio no: una
  classe, un telefono sul leggio, più di un allievə alla volta.
- **Il soundcheck su un telefono vero.** La misura dell'estensione e della portata
  è provata con un microfono finto e con misure seminate, non suonando davanti a un
  telefono.
- **Il rigo in mano a un ragazzə.** La grafica è verificata in un browser senza
  testa a 390×844, e le proporzioni le ha giudicate chi legge gli spartiti; non è
  ancora stata guardata su un telefono vero, alla luce di una stanza, con le dita
  di chi suona.

## Com'è fatto il repository

```
src/audio/      il rilevatore: FFT, somma armonica, attacchi; microfono e tono (senza logica)
src/exercise/   il motore dell'esercizio, il riepilogo, le impostazioni e la lista dell'insegnante (senza DOM)
src/score/      la mappa tasto → rigo, la geometria del foglio, VexFlow
src/session/    la macchina a stati della sessione e il log scaricabile (senza DOM né audio)
src/spike/      la pagina di misura
tests/          i test del rilevatore, del motore, della mappa, della prova, della lista e del log
scripts/        serve-tls.mjs, il server https usa-e-getta per il telefono
docs/adr/       le decisioni
```

Licenza: GNU GPL v3 o successiva.
