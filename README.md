# suona-la-nota

Esercizi di lettura del pentagramma per ragazzi di 10-13 anni: l'applicazione mostra una nota alla
volta, in chiave di violino e di basso, ascolta il pianoforte dal microfono e passa alla nota
successiva quando sente il tasto giusto o quando scade il tempo. Alla fine dà il punteggio:
quante centrate, quante sbagliate, quante saltate.

**Stato: l'esercizio.** La pagina mostra un bersaglio alla volta, nella chiave che lascia la nota
più vicina al rigo, ascolta il pianoforte dal microfono e risponde subito: verde sulla nota giusta,
rosso sulla sbagliata, e quando l'ottava è incerta non giudica — chiede di ripetere. Otto secondi per
bersaglio, pausa, e la sessione che si chiude da sola a tempo scaduto o a lista esaurita.
Mancano il riepilogo con il punteggio, le impostazioni della prova, la classifica e il log.

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

## Cosa non è ancora verificato

- **L'acustica.** I test coprono l'aritmetica del rilevatore su segnali sintetici. Nessun pianoforte
  vero è ancora passato dal microfono di un telefono vero: è esattamente ciò che lo spike deve
  misurare, e finché non è misurato non ci sono stime di tempi.
- **La grafica del rigo oltre il caso di prova.** VexFlow 5 disegna due righi in `index.html`; il
  passaggio da "una nota" a "il bersaglio giusto, nella chiave giusta" è ancora da fare.

## Com'è fatto il repository

```
src/audio/      il rilevatore: FFT, somma armonica, attacchi (testato, senza DOM)
src/spike/      la pagina di misura
tests/          i test del rilevatore, con segnali sintetici
scripts/        serve-tls.mjs, il server https usa-e-getta per il telefono
docs/adr/       le decisioni
```

Licenza: GNU GPL v3 o successiva.
