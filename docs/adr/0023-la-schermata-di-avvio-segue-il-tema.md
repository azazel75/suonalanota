# La schermata di avvio segue il tema

Con ADR 0021 la pagina segue il tema del sistema. La **schermata di avvio** dell'applicazione
installata no: quella la disegna il sistema operativo leggendo il `background_color` del manifest, e il
manifest era un file solo con `#0b0f14` scritto dentro. Risultato: installata e aperta alle undici di
mattina, l'applicazione faceva un lampo nero prima di diventare bianca.

## Decisione

**Due manifest, e la pagina sceglie quello che serve.** Il build emette `manifest.json` (scuro, come
prima) e `manifest-light.json` (chiaro, `#f4f2ec` come `--bg`). La pagina punta il
`link[rel="manifest"]` alla variante che corrisponde al sistema — `prefers-color-scheme` in
JavaScript, perché qui il CSS non può fare niente — e lo ripunta quando il sistema cambia. Il browser
legge il manifest **quando si installa** l'applicazione, quindi la scelta fatta lì è quella che finisce
sul telefono.

```ts
// src/pwa/manifest-theme.ts
export function manifestHrefFor(light: boolean): string {
  return light ? MANIFEST_LIGHT_PATH : MANIFEST_PATH;
}
```

`manifest.json` resta il default: una pagina che non esegue lo script (o un browser che non lo esegue
per quel link) prende il manifest scuro, che è quello che c'era prima. Niente si rompe, e
l'installazione non dipende da JavaScript.

**L'icona non segue il tema, e va bene così.** È un quadrato scuro con il rigo e la nota: è la faccia
dell'applicazione, non una superficie dell'interfaccia. Una schermata chiara con l'icona scura sopra è
un'icona su un foglio di carta, che è esattamente quello che è; una schermata scura a mezzogiorno è un
lampo nero negli occhi. Cambia solo il campo.

## Perché non le alternative

**`<link rel="manifest" media="(prefers-color-scheme: …)">`.** È nella specifica come proposta, ma
nessun browser lo implementa: se lo si mette, viene ignorato, e la schermata resta quella del primo
manifest.

**Un manifest solo, neutro.** Un grigio medio, o il colore dell'accento: sbaglia in tutti e due i temi,
e sposta il problema invece di risolverlo. Un `background_color` chiaro è un lampo bianco di notte,
uno scuro è un lampo nero di giorno.

**Generare il manifest dal server in base all'header `Sec-CH-Prefers-Color-Scheme`.** Funzionerebbe,
ma sposta una scelta di presentazione dentro nginx, la lega all'header che il browser deve accettare, e
la rende invisibile a chi legge il codice dell'applicazione. Due file e otto righe di script fanno lo
stesso, e si possono provare con i test di unità.

**Disegnare il manifest a runtime con JavaScript.** Il manifest deve essere un file che il browser può
rileggere quando vuole, anche a pagina chiusa e senza script: un blob generato non è quella cosa.

## Conseguenze

- Il pacchetto contiene un file in più (`manifest-light.json`, 20 righe di JSON). Il light **non** sta
  nell'app shell: il browser lo legge quando si installa, e per installare serve la rete. La versione
  della cache continua a derivare dal manifest scuro — i due escono dallo stesso codice, quindi
  cambiano insieme.
- **La schermata resta quella scelta all'installazione**: un telefono che passa al tema scuro dopo
  l'installazione non ridipinge lo splash già memorizzato. Il link resta aggiornato, quindi una
  rilettura del manifest da parte del browser — che avviene, ma non a comando — cade sulla variante
  giusta.
- Chi installa l'applicazione in tema chiaro e poi la usa di notte vedrà uno splash chiaro per una
  frazione di secondo. È il compromesso opposto a quello di prima, e costa meno: da scuro a scuro non
  c'era niente da vedere, ma alle undici di mattina il lampo c'era.

## Verifica

- `tests/manifest.test.ts` (**4 test**): i due percorsi, la scelta per tema, i colori di ciascuna
  variante, e che tutto il resto del manifest sia identico fra i due.
- Controlli del browser (**3 nuovi**, 140 in tutto, due volte): in tema scuro il link punta a
  `/manifest.json`; passando al chiaro — senza ricaricare — punta a `/manifest-light.json`; e il file
  servito ha davvero `background_color` e `theme_color` a `#f4f2ec` con `start_url` `/`.
