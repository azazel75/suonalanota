# La classifica locale

A fine sessione l'allievə scrive il suo nome e si vede in classifica. È la parte del prodotto che
trasforma un esercizio in un gioco, e l'unica che conserva qualcosa di una persona: un nome, accanto a
un numero. Per questo ha una decisione scritta, come i due file dell'ADR 0012.

Tre domande andavano decise: **di chi è una classifica**, **cosa tiene una riga**, e **quando una
sessione diventa una riga**.

## Decisione

**La chiave è `normalise(settings)`**: range, durata, tempo per bersaglio, tetto ai colpi, modalità.
Due prove che il pannello mostra uguali hanno la stessa classifica; confrontarsi su range e durate
diverse non vuol dire niente (specifica, user story 14). **L'ADR 0002 ne nominava tre** — range, durata
e modalità — e la specifica quattro, senza il tetto: i cinque campi del ticket sono la decisione, perché
il tetto ai colpi cambia il punteggio che si ottiene e il tempo per bersaglio cambia quante note entrano
in un minuto. Il preset e la lista della maestra **non** ci sono: scelgono quali note, non quanto è
difficile la prova.

**Una riga per ragazzə, con la prova migliore.** L'identità è il nome senza maiuscole: `Marta` e `marta`
sono la stessa persona su un telefono di famiglia. Si tiene la prova con più corrette, a parità più note
al minuto, a parità la più recente — gli stessi tre criteri dell'ordine, applicati una volta sola nella
riduzione, così «la prova migliore» e «la riga sopra» non possono contraddirsi.

**La riga si scrive alla conferma del nome, non alla fine della sessione.** Il campo si apre pieno col
nome dell'ultimo run (`suona-la-nota.nome`, indipendente dalla prova); chi lo lascia vuoto prende
`utente1`, `utente2`, … il primo libero **di quella classifica**, e il campo vuoto lo dice già nel
`placeholder`. La memoria del nome tiene solo un nome che qualcuno ha **scritto**: un run ripiegato su
`utenteN` non riempie il campo la volta dopo, altrimenti il secondo ragazzə che conferma senza digitare
finirebbe nella riga del primo, e `utente1` sarebbe l'unico ripiego che il telefono dà mai. Finché non
si conferma non compare nessuna riga: un nome che nessuno ha dato non entra in una tabella che i ragazzə
leggono. (`utenteN` è una parola che il glossario evita per la persona — lì è **Allievə**: ma la
specifica la impone come nome di ripiego, e un'identità non è un ruolo.)

**Il documento sta in `localStorage`, versionato, con i nomi in italiano.** La forma è
`{ "versione": 1, "prova": "48-72|60000|8000|-|random", "voci": [{ "nome": "anna", "corrette": 11,
"note_al_minuto": 15, "quando_ms": 1794178885000 }] }`. L'istante si chiama `quando_ms` e non `quando`:
nel log dell'ADR 0012 `quando` è una data ISO, e due campi con lo stesso nome e due significati sono la
trappola che un file scritto per essere riletto non deve tendere. È un intero di millisecondi, non una
data: la classifica non lascia il dispositivo, quindi l'istante deve solo ordinare e sopravvivere al
giro di boa. Il documento intero si rifiuta se la forma o la versione non tornano; una **riga** rotta si
scarta, si conta, e non costa la classifica che tutti gli altri leggono ancora.

**Il posto si dice anche quando non si vede.** La schermata disegna le prime cinque righe e, se il
ragazzə è sotto, accoda la sua riga con il suo numero e una frase («Sei 7° su 12 ragazzə per questa
prova.»). Un posto che si può vedere solo scorrendo è un posto che l'allievə deve chiedere a un adulto.

## Conseguenze

- La classifica non esce dal dispositivo e non c'è modo di farla uscire: non si esporta, non si importa,
  nessuna rete (user story 26). Un file sarebbe stato il modo più facile di tradire quella promessa.
- Cambiare configurazione mostra un'altra classifica senza un ramo nel codice: la chiave è nel nome
  della chiave di storage.
- Cancellare una voce non è deciso: è una decisione di prodotto da chiedere alla maestra (specifica,
  «Aperto»). Per ora la classifica cresce e basta; su un telefono di famiglia sono decine di righe.
- Le note al minuto sono quelle che il motore arrotonda a un decimale: due prove che differiscono sotto
  il decimo risultano pari e decidono sulla data. È un pareggio vero, non una differenza nascosta.

## Alternative scartate

**Una classifica sola, uguale per ogni prova.** Confronta un esercizio da sessanta secondi con uno da
cinque, e un range base con uno avanzato: il numero più alto non dice chi legge meglio.

**Il preset e la lista nella chiave.** Sarebbe coerente con «un'altra configurazione, un'altra
classifica», ma spezzerebbe in classifiche da una riga le prove progressive, che sono quelle su cui si
misura il progresso. Se la maestra lo chiede, è una riga in `trialKey`.

**Un registro globale dei nomi**, per non riusare `utente1` in due classifiche. Su un telefono che
passa di mano le due tabelle non si vedono mai insieme, e un registro globale è un dato in più che
nessuno usa.

**Salvare da soli alla fine della sessione.** Metterebbe in classifica un nome che nessuno ha dato, o
un `utenteN` che il ragazzə non ha mai visto.

**Esportare e importare la classifica come file.** Il log esce perché serve alla maestra per capire se
sbaglia il ragazzə o l'applicazione; la classifica è dei ragazzə e resta sul telefono.
