# L'ascolto passa solo dal microfono

L'allievo suona un pianoforte acustico o digitale, su un telefono o un tablet, a casa o in aula.
Web MIDI esisterebbe solo con uno strumento digitale collegato e un browser Chromium, cioè mai nel
caso più frequente (pianoforte acustico, iPad). Abbiamo quindi deciso che l'unico ingresso audio è
il microfono, e che il MIDI è un miglioramento futuro e non una scorciatoia di v1.

## Conseguenze

- "Altezza esatta su tutta la tastiera" non è fisicamente garantito: un microfono di telefono è
  tagliato in basso, e serve una finestra di analisi lunga per misurare A0. Il soundcheck misura la
  portata udibile del dispositivo e l'esercizio non propone bersagli fuori da quella portata.
- L'errore dominante è l'ottava, ed è indistinguibile da un errore dell'allievo. Per questo ogni
  colpo viene registrato con l'altezza rilevata e i margini: senza il log, un falso negativo è
  indistinguibile da una risposta sbagliata e la maestra smette di fidarsi dell'applicazione.
- Un pedale di risonanza abbassato rende gli attacchi indistinguibili: le istruzioni chiedono note
  staccate, e gli attacchi mancanti finiscono nel log.

## Alternative scartate

**Solo MIDI.** Preciso e a bassa latenza, ma esclude il pianoforte acustico e Safari: cioè il caso
principale.
**Ibrido (MIDI se c'è, microfono altrimenti).** Due motori da misurare e da mantenere, per un
pubblico che non collega lo strumento al telefono. Scartato per v1, non per sempre.
