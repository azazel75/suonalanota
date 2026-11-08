# Il rilevatore: attacco separato dal pitch, evidenza della fondamentale, ricerca limitata al range

Primo spike su un pianoforte a mezza coda Yamaha, microfono di un telefono Android di fascia media
(Android 15, Firefox 160), 265 colpi su 66 note di riferimento, almeno 3 pressioni per nota. Le
condizioni complete sono in [protocollo-di-misura.md](../protocollo-di-misura.md): **coperchio
chiuso**, telefono in verticale sul leggio, pedale mai usato. Il 72% dei colpi ha riconosciuto la
nota giusta, ma la distribuzione per registro dice cose che cambiano il progetto:

| registro | colpi | giusti | ottave sopra | altri |
| --- | --- | --- | --- | --- |
| Sol1–Re#2 (49–78 Hz) | 31 | **2 (6%)** | 12 | 17 |
| Mi2–Si2 (82–123 Hz) | 36 | 24 (67%) | 0 | 12 |
| Do3–Do5 (131–523 Hz) | 128 | 102 (80%) | 6 | 20 |
| Do#5–Fa6 (554–1397 Hz) | 70 | 62 (89%) | 0 | 8 |

Le decisioni che ne seguono.

## 1. L'attacco ha una finestra sua, corta, e un isteresi

L'11% dei colpi cade entro 300 ms dal precedente, con distacchi di 133 e 150 ms — cioè
esattamente il cooldown (120 ms) più il passo di analisi (40 ms). La causa è che la finestra di
analisi è di 341 ms (servono per il registro grave) e la rampa d'attacco resta sopra soglia per
tutta la durata della finestra: con un cooldown di 120 ms un solo attacco produce 3-4 colpi. Su
La3 sono stati registrati 11 colpi per 3 pressioni.

Il rilevamento degli attacchi usa quindi una finestra corta (2048 campioni, 43 ms) e un isteresi:
dopo un attacco non si riarma finché il flusso non scende sotto metà soglia. Il cooldown resta come
rete di sicurezza, non come unico freno. La finestra lunga serve al pitch e non all'attacco.

## 2. La ricerca dei candidati è limitata al range dell'esercizio

Sei colpi hanno prodotto note fuori dal range richiesto (Do1, Do#1, Re1, Mi1, Fa1, Fa#1), tutti
generati da colpi di tocco sul pianoforte o da rumori a bassa frequenza: punteggi fino a 0.93 con
livello a −23 dBFS. Cercare su tutti gli 88 tasti regala a questi eventi un candidato plausibile.
La ricerca si fa sulle note del range attivo, e due colpi identici consecutivi sulla stessa nota
non contano come due attacchi.

## 3. La fondamentale deve avere evidenza, e se non ce l'ha la nota è fuori portata

Tutti i 18 errori di ottava sono **verso l'alto**, con un margine fra la nota giusta e quella
sbagliata di 0,5–3,3 dB: sono pareggi strutturali, non sviste. Il caso peggiore è Sol1, riconosciuto
come Re3 — cioè la **terza armonica** (147 Hz), perché a 49 Hz il microfono del telefono non riceve
niente e la somma armonica premia la nota la cui fondamentale coincide con la parziale più forte
che si sente.

Due regole, entrambe necessarie:

- **evidenza della fondamentale**: se il vincitore ha la fondamentale debole e l'ottava sotto ne ha
  una presente, vince l'ottava sotto. È la risoluzione classica della fondamentale mancante, e
  funziona perché la parziale 2 dell'ottava sotto è la fondamentale del vincitore: la differenza è
  se c'è energia *sotto*;
- **portata udibile**: se la regione della fondamentale del vincitore sta sotto il rumore di fondo
  più un margine, la nota non è stata sentita e il colpo non si registra. È il dato che il
  soundcheck deve produrre.

## 4. La soglia non è un numero assoluto, e non è uno slider

I punteggi del registro acuto sono da 5 a 10 volte più piccoli di quelli del registro centrale
(0,003–0,008 contro 0,03–0,06): una singola soglia assoluta non può servire quattro ottave. Nello
spike il valore salvato era 0,0178, e 154 colpi su 265 hanno un punteggio inferiore: la soglia è
cambiata durante la sessione. La catena più probabile è: i colpi duplicati sembrano falsi positivi,
si alza la soglia, le note acute spariscono — che è esattamente il difetto riferito.

La soglia si ricava dal rumore misurato nel soundcheck, in banda, e si confronta con un punteggio
normalizzato per registro. Non è un parametro che l'allievo o la maestra devono indovinare.

## 5. Il log deve registrare la frequenza misurata

Lo spike salvava la frequenza *nominale* della nota vincente (`midiToHz(midi)`), non quella
misurata: davanti a un colpo che dice "La♯4 invece di La4" non si può distinguere un errore del
rilevatore da un dito finito sul tasto accanto. Il log v2 registra la frequenza misurata della
fondamentale, la stabilità del candidato su più finestre e le impostazioni in vigore per quel
colpo, non solo quelle finali.

## Conseguenze

- Il range "avanzato" Si1–Re6 resta il range *nominale*: su questo telefono il limite misurato è
  intorno al Mi2, e il soundcheck può solo restringere, mai allargare.
- Senza il punto 3 la fascia 49–78 Hz va dichiarata fuori portata su qualunque telefono: oggi è
  l'unica parte del range richiesto che il prodotto non può coprire.
- I colpi duplicati non abbassano la precisione del riconoscimento (i duplicati riconoscono la nota
  giusta) ma consumano il credito di errori di una pressione sola: è un difetto di punteggio, e va
  corretto prima di scrivere l'esercizio.
