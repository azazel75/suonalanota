# Specifica dell'esercizio — versione 0.1

Solo le parti già decise. Le voci in fondo sono le domande ancora aperte: finché non sono chiuse,
questo documento non è completo e non è una descrizione dell'applicazione finita.

## Il compito

Una nota alla volta, scritta su un pentagramma in chiave di violino o di basso. L'allievo la suona
sul pianoforte; l'applicazione ascolta dal microfono. Nessuna tastiera sullo schermo: la mappa fra
rigo e tasto è il compito, mostrarne la soluzione lo annulla.

L'altezza richiesta è **esatta**: l'ottava fa parte della risposta.

## Durata

Sessione di 60 secondi, configurabile. L'orologio parte quando appare il primo bersaglio. Una pausa
esiste ma non consuma tempo. La sessione finisce quando scade il tempo **o** quando la lista dei
bersagli è esaurita, e il riepilogo dice quale delle due.

## Range delle note

Due preset, entrambi configurabili come minimo e massimo:

| preset | estensione | MIDI |
| --- | --- | --- |
| **base** | Do3 – Do5 | 48 – 72 |
| **avanzato** | Si1 – Re6 | 35 – 86 |

Il range effettivo è l'**intersezione di tre vincoli**:

```
range nominale  ∩  compasso dello strumento  ∩  portata udibile misurata
```

Il compasso si assume quello di un pianoforte (88 tasti, La0–Do8) finché il soundcheck non misura
altro; la tendina "quanti tasti" serve solo come scorciatoia per non proporre note che non esistono.
Su una tastiera da 61 tasti (Do2–Do7) l'intersezione con l'avanzato parte da Do2, cioè dal primo tasto
dello strumento: il soundcheck lo escluderà comunque, ma è il motivo per cui il compasso entra nel
conto e non è una costante.

Nessuna nota fuori dal range attivo viene **proposta** né **cercata**: il range limita anche la
ricerca del rilevatore, non solo il generatore della sequenza.

Il range nominale è quello della tabella. Il range **effettivo** lo misura il soundcheck e può
soltanto restringerlo (vedi ADR 0004): su un telefono di fascia media la parte 49–78 Hz è risultata
inaudibile, quindi l'avanzato, su quel dispositivo, parte più in alto — e se il limite misurato
arrivasse a Do3 l'avanzato coinciderebbe col base. Non è un difetto della misura: è la misura.

## Sequenza dei bersagli

Tre modi, scelti prima di iniziare:

- **casuale** nel range attivo, senza ripetizione di una nota già uscita nella sequenza;
- **preset** progressivi, forniti con l'applicazione;
- **lista** preparata dalla maestra, modificabile in-app e esportabile come JSON.

## Verdetti e limiti

Il verdetto di un bersaglio è **centrata**, **sbagliata** o **saltata** (matrice di ADR 0003,
aggiornata da ADR 0008). Ma prima del verdetto c'è un caso che verdetto non è: il **colpo ambiguo**,
quello in cui la nota vincente e la sua ottava stanno a meno di 3 dB e il rilevatore non può
scegliere. Un colpo ambiguo **non costa un tentativo**: l'applicazione chiede di ripetere la nota,
perché l'ottava fa parte della risposta e indovinare sarebbe peggio che chiedere.

Limiti, di default: **8 secondi per bersaglio**, e nessun tetto ai colpi nel frattempo — un tetto ai
colpi errati esiste, è configurabile e di default è spento.

| evento | verdetto |
| --- | --- |
| un colpo contiene l'altezza esatta del bersaglio | centrata |
| tempo scaduto, con almeno un colpo errato non ambiguo | sbagliata |
| tempo scaduto, con soli colpi ambigui o senza colpi | saltata |
| tetto dei colpi errati raggiunto (se configurato) | sbagliata |
| la sessione finisce con il bersaglio a schermo | non conteggiata |

Nessun suono di riferimento viene emesso durante l'esercizio: il feedback sonoro è un beep neutro,
quello visivo un lampeggio verde sulla centrata, rosso sull'errore, e per un colpo ambiguo nessuno
dei due — solo l'invito a ripetere.


## Soundcheck

Alla prima apertura, e su richiesta dalle impostazioni:

1. permesso del microfono, che richiede un gesto esplicito;
2. **compasso**: il ragazzo suona il tasto più basso e il più alto del suo strumento (di default si
   assume un pianoforte da 88 tasti; una tendina "quanti tasti" è una scorciatoia, non la verità);
3. **portata udibile**: ripete i due estremi e una nota centrale, per misurare cosa il dispositivo
   sente davvero; un estremo non sentito restringe il range;
4. **cuffie e volume**: se il livello resta al rumore di fondo, il messaggio è "controlla il volume
   dello strumento, o togli le cuffie" — non "tempo scaduto". Su una tastiera elettronica suonare in
   cuffia è normalissimo, e senza questo controllo l'applicazione sembra rotta.

Può essere saltato, ma in quel caso i range che il dispositivo non ha dimostrato di sentire vengono
esclusi di default. Lo stesso controllo "sei in cuffia o a volume zero" vale durante un esercizio:
dopo circa 5 secondi di silenzio assoluto, il messaggio compare al posto del conteggio.

## Punteggio e classifica

A fine sessione: centrate, sbagliate, saltate, totale, note al minuto, ed elenco delle note
sbagliate. Durante la sessione un contatore discreto, non un HUD.

Classifica locale al dispositivo, con nickname facoltativo. Nessun dato lascia il dispositivo.

## Log

Ogni sessione produce un log scaricabile in JSON: bersaglio, altezza misurata, verdetto, istanti,
impostazioni in vigore. Serve alla maestra per distinguere "il ragazzo sbaglia" da "l'applicazione
sbaglia".

## Non ancora deciso

- **Quale chiave per un dato bersaglio.** Le due chiavi convivono nella stessa sessione (deciso), ma
  resta da dire *come* si sceglie quella con cui disegnare una nota: la chiave che lascia la nota più
  vicina al rigo, oppure un'alternanza dichiarata (una battuta per chiave). Cambia il disegno e
  cambia cosa impara l'allievo.
- Il nome pubblico e il dominio: rimandato, e non blocca niente (la build è una cartella statica).
- Il giro di misura su un pianoforte verticale e su una tastiera elettronica: oggi non sono
  accessibili. La previsione da falsificare è "acuti meglio, grave peggio" sulle tastiere
  elettroniche; il dato della mezza coda a coperchio chiuso non descrive nessuno dei due casi.

