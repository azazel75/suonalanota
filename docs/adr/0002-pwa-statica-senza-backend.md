# PWA statica, senza backend, con la classifica sul dispositivo

I due siti che potrebbero ospitare l'esercizio sono sorgenti Hugo serviti da nginx come directory
statiche, e la pubblicazione dell'applicazione non è ancora decisa (probabilmente un dominio a
parte). La build produce quindi una sola cartella statica autosufficiente, senza alcuna assunzione
su percorso, host o reverse proxy, e la classifica resta nel `localStorage` del dispositivo.

## Conseguenze

- L'applicazione funziona offline, cosa che in aula conta più della classifica condivisa.
- Nessun dato di un minorenne lascia il dispositivo: nessun consenso, nessun titolare del
  trattamento, nessuna retention da dichiarare.
- La classifica è per dispositivo: due telefoni sono due classifiche. È accettato per v1.
- Quando il dominio sarà deciso, si copia `dist/`. Se l'esercizio dovrà vivere sotto un
  sottopercorso, cambia lo scope del service worker: è l'unica cosa da rivedere.

## Alternative scartate

**Un servizio minimo su reventlov (API + database).** Darebbe una classifica condivisa fra allievi,
ma introduce dati di minori, un secondo punto di guasto e una dipendenza dalla rete della scuola,
per una funzione che serve solo alla fine della sessione.
