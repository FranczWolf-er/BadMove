# BadMove – plán vývoje

## Naplánováno
- Otestovat na iPhonu z plochy a sepsat, co chybí nebo vadí.
- Zapnout zálohu na OneDrive (registrace v Entra, viz NAVOD.md).
- Výběr trenéra: v nastavení si vybereš trenéra a ten mluví svými vlastními hláškami. Každý trenér má jiný přístup, například:
  - **Drsňák:** zlý a drzý, nic neodpustí („Gauč tě miluje. Nenech se.“),
  - **Kámoš:** milý a povzbudivý, chválí i malé pokroky,
  - případně další povahy (suchý vtipálek, vojenský instruktor…).
  Hlášky jsou rozdělené podle situace (nic hotovo, rozjeto, splněno, expres, marodka, zapsaný trénink, nový osobák), takže nový trenér znamená jen novou sadu textů.

## Nápady k rozhodnutí
- Připomínky přímo z aplikace (web push na iPhonu potřebuje malý server, např. zdarma přes Cloudflare Workers).
- Úprava zapsaného tréninku a výkonu (zatím jen smazání).
- Rekordy, kde je méně lépe (čas na 5 km, sprint).
- Odznaky za milníky série (7, 30, 100 dní) a vlastní odměny.

- Sdílení série s kamarády a vzájemné hecování.
- Plán tréninků na týden (kickbox út/čt, funkční so…) a jeho odškrtávání.

## Hotovo
- Denní cíle s plnou a expres verzí, série se žolíkem, marodka, kalendář 5 týdnů.
- Deník tréninků s týdenním souhrnem (tréninky, minuty, regenerace), osobní rekordy s historií.
- Knihovna vlastních druhů tréninku (výběr v deníku, regenerační druhy se počítají do regenerace).
- Grafy pokroku u rekordů, měsíční a roční přehled deníku.
- Vlastní cíle, ukázková data, export a import JSON, záloha na OneDrive (připravená, čeká na client ID).
- Instalace na plochu, offline režim, upozornění na novou verzi.
