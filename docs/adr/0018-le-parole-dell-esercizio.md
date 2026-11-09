# Le parole dell'esercizio: la nota, la pressione, il tentativo

Il prodotto parlava di «bersagli» e di «colpi», e offriva «preset». Sono tre parole sbagliate per
quello che succede davvero in una lezione di lettura: il bersaglio e il colpo sono il gergo del tiro a
segno, dove qualcuno mira e qualcosa viene colpito; qui qualcuno **legge una nota** e **preme un
tasto**, e nessuno sta mirando. «Preset» è inglese in un prodotto che parla italiano, e la maestra era
un'eccezione dichiarata alla regola della schwa. Il giro 9 aveva già corretto «compasso» e «range»;
questo chiude il vocabolario.

## Decisione

| prima | adesso | perché |
| --- | --- | --- |
| bersaglio | **nota** | l'oggetto è una nota: il glossario la definisce già «il segno scritto sul rigo, una posizione più una chiave», e la sessione ne chiede una alla volta. Quando serve il singolare: «la nota in corso» |
| colpo | **pressione** | è la pressione di un tasto riconosciuta dal microfono: un attacco con le altezze che contiene |
| colpo ambiguo | **pressione ambigua** | la stessa cosa, detta con la parola giusta |
| — | **tentativo** | una pressione che non contiene la nota chiesta. Il *numero massimo di tentativi* la chiude come sbagliata; una pressione ambigua non è un tentativo |
| preset | **lista predefinita** | le tre raccolte fornite con l'applicazione sono liste di note, in ordine di difficoltà; la modalità si sceglie da una lista predefinita, e la configurazione lo dice così |
| maestra | **insegnante** | la persona che prepara gli esercizi; la parola è già né maschile né femminile, e l'eccezione alla schwa sparisce |
| orologi (nella configurazione) | **durate** | i due numeri sono la durata dell'esercizio e il tempo per nota, non due orologi |
| ascolto | **sensibilità del dispositivo** | il blocco della configurazione e la schermata: quello che si misura è quanto il telefono sente, non l'atto di ascoltare |
| «Ascolto in corso» | «**Misura in corso**» | la schermata mentre misura |
| «sessione finita» | «**esercizio concluso**» | il riepilogo: la parola «sessione» resta tecnica (il log dice `fine`), l'intestazione parla di esercizio |
| «chiudi la nota dopo» | «**passa alla prossima nota dopo**» | il limite dei tentativi manda avanti, non chiude niente |
| «prime note, in violino» | «**prime note, in chiave di violino**» | e «Il rigo di basso» diventa «Prime note, in chiave di basso»: le liste dicono la chiave |
| «secondi di sessione» | «secondi di **durata dell'esercizio**» | |
| «tetto ai colpi» | «**numero massimo di tentativi**» | |
| «lista della maestra» | «lista dell'**insegnante**» | |

**Nel glossario**: *Bersaglio* non c'è più (la parola è nell'`_Avoid_` di *Nota*), *Colpo* e *Colpo
ambiguo* diventano *Pressione* e *Pressione ambigua*, *Attacco* resta l'inizio del suono, si aggiungono
*Tentativo* e *Lista predefinita*, e *Maestra* diventa *Insegnante*. «Ascolto» finisce negli `_Avoid_`
di *Portata udibile* e *Soundcheck*: in italiano è l'atto, non la cosa, e il blocco che misura quanto
il telefono sente si chiama **Sensibilità del dispositivo**. Le sezioni che si chiamavano «L'ascolto»
diventano «Il microfono e lo strumento» (glossario) e «Il microfono» (intesa). Restano `spike/ascolto.html`
e l'id dell'elemento `#sensibilita`: sono un URL e un nome tecnico, non parole del prodotto.

**Nel file del log**, che è un file per l'insegnante e parla italiano fino in fondo:

- `bersagli` → `note`, `colpi` → `pressioni`;
- `tempo_per_bersaglio_secondi` → `tempo_per_nota_secondi`, `tetto_colpi` → `tentativi_massimi`;
- `impostazioni.preset` → `impostazioni.lista_predefinita`;
- `fine.motivo`: `lista` → `note`. Il motivo diceva «la lista è finita», che ora non chiarisce più
  quale delle due; `note` dice che sono finite le note della sequenza;
- `modalita` vale `casuale`, `lista predefinita`, `lista dell'insegnante`.

La **`versione` resta 1**: cambiano nomi, non significati, e nessun file è mai uscito dal repository —
la stessa ragione per cui `centrate` era diventato `corrette` senza alzare la versione (ADR 0014).

**Nel codice** il tipo `Colpo` è diventato `Pressione` e i suoi derivati (`PressioneLog`,
`pressioneLog`, `HeardPressione`, `SoundcheckPressione`), così il codice non conserva la parola
ritirata. Restano tecnici, e in inglese, `PRESETS`, `presetId` e i valori dell'URL (`?mode=preset`,
`?preset=…`): sono identificatori e un'interfaccia, non parole del prodotto, come `?range=`.

Il file che l'insegnante esporta si chiama **`lista-dell-insegnante.json`** (era
`lista-della-maestra.json`): è una promessa a chi lo conserva, e nessuno l'ha ancora ricevuto.

**Fuori dagli spike**, che non sono il prodotto: nelle pagine di misura il campo scaricato resta
`colpi`. Sei log di misura archiviati nel repository usano quella chiave, e i giri si confrontano fra
loro (`docs/protocollo-di-misura.md`): rinominarla renderebbe un giro nuovo illeggibile accanto ai
primi cinque. Le pagine dicono «pressione», il file dice `colpi` — il primo è prosa, il secondo è un
contratto con l'evidenza.

## Conseguenze

- Il glossario, la specifica, l'intesa, il README, il protocollo di misura e i commenti usano un solo
  vocabolario; gli ADR 0001–0017 restano come sono stati scritti, titoli compresi, e citarli per nome
  non è un errore.
- «Tentativo» diventa una parola di prodotto: la configurazione ha un *numero massimo di tentativi* e
  il glossario dice che una pressione ambigua non ne consuma uno. Prima la parola esisteva solo nella
  prosa degli ADR.
- Il log cambia cinque nomi di campo e un valore; chi ha già scaricato un log non esiste, e la
  versione lo dice.
- «Insegnante» toglie l'ultima eccezione alla schwa: le parole per le persone sono `allievə` e
  `ragazzə`, e `insegnante` è già neutro.

## Alternative scartate

**Attacco** per il «colpo». Sarebbe stato musicale, ma l'attacco è l'istante in cui il suono nasce, e
il glossario lo usa già per quello: la pressione è l'evento che il microfono ha riconosciuto *in*
quell'attacco, con le sue altezze e le sue misure. Due parole per due cose.

**Suono** per il «colpo». Il glossario dice che la nota non è il suono: chiamare «suono» l'evento
giudicato avrebbe confuso il fenomeno fisico con la misura.

**Consegna** per il «bersaglio». È didattico, ma è un compito, non una nota; e la sessione non
consegna niente, chiede.

**Progressione** per il «preset». In musica è una figura armonica o melodica, e le tre raccolte sono
percorsi di difficoltà, non figure.

**Lasciare «maestra» come eccezione.** Era dichiarata nel glossario, ma «insegnante» è già neutro: non
c'era ragione di tenere un'eccezione per una parola che non ne ha bisogno.

**Cambiare i parametri dell'URL.** `?mode=preset` e `?preset=` restano: un link è un'interfaccia, e
rinominarne uno solo sarebbe peggio che lasciarli tutti in inglese.
