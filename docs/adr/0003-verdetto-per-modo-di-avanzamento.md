# Il verdetto dipende da come il bersaglio si chiude, non dal timer

> **Aggiornato da [ADR 0008](0008-il-colpo-ambiguo.md)**: la matrice resta valida per i colpi non
> ambigui; un bersaglio che si chiude con soli colpi ambigui conta come *saltata*, non *sbagliata*.

I limiti di un bersaglio sono due e sono indipendenti: un numero massimo di colpi errati e un
tempo massimo. Configurarli entrambi è utile (un allievo veloce e insicuro ha bisogno dell'uno, uno
lento dell'altro), ma lascia aperta la domanda su cosa si registra quando è il tempo a chiudere il
bersaglio. Abbiamo deciso che il verdetto lo decide il modo in cui il bersaglio si chiude:

| Evento | Verdetto |
| --- | --- |
| un colpo contiene l'altezza esatta del bersaglio | centrata |
| il bersaglio è chiuso dal numero massimo di colpi errati | sbagliata |
| il tempo scade, con almeno un colpo errato | sbagliata |
| il tempo scade, senza nessun colpo | saltata |
| la sessione finisce mentre il bersaglio è a schermo | non conteggiata |

## Conseguenze

- Il punteggio ha tre conteggi e non due: "sbagliata" vuol dire che l'allievo ha provato e non ci è
  riuscito, "saltata" vuol dire che non ha provato. Confonderle renderebbe il punteggio illeggibile
  per la maestra, che vuole sapere se il problema è di lettura o di tempo.
- Un timeout da solo non è un errore: chi non ha ancora provato non ha sbagliato.
- Il bersaglio a schermo quando scade il tempo non entra nelle statistiche: non è stato né letto né
  suonato, e contarlo come saltato punirebbe la fine della sessione invece della prestazione.
