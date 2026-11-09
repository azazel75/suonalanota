# Il guscio offline

A scuola il wifi non c'è. Un'applicazione che si interrompe al primo salto di rete è peggio di nessuna
applicazione, e una PWA che si può installare ma non apre senza rete è una scheda sulla schermata
iniziale che delude nel momento in cui serve. L'ADR 0002 aveva già deciso che il prodotto è una PWA
statica, senza backend: questo dice come il guscio arriva sul telefono e come si aggiorna.

## Decisione

**Manifest e service worker sono il prodotto del build, non due file scritti a mano.** Un plugin in
`vite.config.ts` gira in `generateBundle` con `enforce: 'post'` — dopo il passo HTML di Vite, senza il
quale `index.html` non è ancora nel bundle — e da **quell'elenco di file appena emessi** scrive
`manifest.json` e `sw.js`. Nessuno dei due esiste nel repository: sono dentro il pacchetto Nix come
tutto il resto, e non c'è un passo a mano da ricordare.

**La versione della cache è il contenuto.** `FNV-1a` a 64 bit su percorso e byte di ogni file del
guscio, più il manifest e una revisione del worker: sedici caratteri esadecimali, che diventano il nome
della cache (`suona-la-nota-<versione>`). Poiché i nomi dei chunk contengono l'hash del contenuto, ogni
modifica al codice cambia `sw.js` byte per byte; il browser rilegge il worker a ogni navigazione, trova
un byte diverso e installa. `install` precarica il guscio e chiama `skipWaiting()`, `activate` cancella
tutte le cache col nostro prefisso tranne quella corrente e chiama `clients.claim()`. Una build nuova si
vede alla visita successiva, senza svuotare i dati del browser.

**Il guscio è l'applicazione, e solo ciò che il build sa versionare.** Si precaricano `index.html`, i
chunk che carica e il manifest: i file che il build emette. **Non** si precaricano i file di `public/` —
la favicon e le due icone — perché Vite li copia senza farli passare dal bundle: i loro byte non
possono entrare nella versione, e una voce di guscio che non si può versionare è una voce che invecchia
in silenzio. Restano raggiungibili dalla rete; offline manca l'icona nella scheda, che è un dettaglio, e
l'icona sulla schermata iniziale il sistema la conserva da quando l'applicazione è stata installata.
Le pagine spike (`/spike/*.html`) restano raggiungibili per chi misura ma **fuori dal guscio**: non si
precaricano, e una navigazione verso `/spike/` non riceve risposta dal worker. Così, con la rete spenta,
una pagina spike dà l'errore onesto del browser e non l'esercizio sotto l'indirizzo sbagliato.

**Il worker risponde alle navigazioni dalla cache, con la rete come ripiego.** È il verso giusto per
un'applicazione che deve aprire in classe: meglio una pagina di ieri che un errore di oggi. Il prezzo,
dichiarato, è che un aggiornamento non arriva a metà sessione.

**Il manifest si chiama `manifest.json`.** `.webmanifest` è corretto e i server statici non lo sanno
servire: `python -m http.server` e nginx rispondono `application/octet-stream`, e Chrome rifiuta il
manifest in silenzio — un'installazione che fallisce senza dire perché. `manifest.json` esce come
`application/json` da qualunque server.

## Conseguenze

- Le icone 192 e 512 sono binari nel repository, ricavati una volta da `favicon.svg`. Non sono nel
  guscio e non si precaricano (vedi sopra): cambiarle è un cambio che il sistema rilegge da solo, e la
  tentazione di «rinominarle per forzare la cache» non serve a niente perché non c'è nessuna cache da
  forzare.
- Lo scope è `/`, coerente con i percorsi assoluti che il build emette. Se un giorno l'applicazione
  finisce sotto un sottopercorso, `start_url`, `scope` e la lista del guscio vanno rivisti insieme.
- Il servizio che ospita `dist/` non deve servire `sw.js` con una cache lunga: i browser aggirano la
  cache HTTP per il file del worker, ma un proxy che lo tiene per sempre ritarderebbe gli aggiornamenti.
- Su iOS il gesto di installazione resta poco scoperto: è il rischio che il ticket dichiara, non un
  criterio da soddisfare qui. `apple-touch-icon` e `apple-mobile-web-app-capable` ci sono; se il primo
  giro in classe mostra che nessuno installa, il «funziona senza rete» va riprogettato.
- Nessuna dipendenza npm nuova: `package-lock.json`, `package.json` e `npmDepsHash` non cambiano, e la
  build resta offline e deterministica.

## Alternative scartate

**`vite-plugin-pwa`.** Fa molto più di quello che serve (workbox, strategie per famiglia di richieste,
prompt di aggiornamento) e costa una dipendenza nuova con il suo `npmDepsHash`: il guscio di questa
applicazione è un elenco di sette file noto al build, non un problema di caching generale.

**Un `sw.js` scritto a mano in `public/`.** Sarebbe l'unico file del prodotto che non sa quali nomi
hanno i chunk: o si tiene una cache a runtime (che alla prima visita offline non ha niente) o si
duplica a mano la lista, e la seconda dimenticanza rompe l'applicazione in silenzio.

**Precaricare anche le pagine spike.** Circa 18 kB per una funzione che in classe non si usa, e
soprattutto l'esercizio servito sotto `/spike/ascolto.html` quando la rete manca.

**Aggiornare a forza con `skipWaiting` più una ricarica.** Interromperebbe una sessione in corso: il
ragazzə sta leggendo una nota, e la pagina si ricarica. Una sessione vale più di un aggiornamento
immediato.
