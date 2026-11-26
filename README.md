# BadMove

Drzá motivační aplikace na každodenní pohyb: denní cíle, série, deník tréninků a osobní rekordy.

- **Dnes:** denní cíle (ranní protažení, dřepy, kliky, břicho a záda, procházka) s plnou a expres verzí. Obojí drží sérii.
- **Série se žolíkem:** jeden vynechaný den za týden se omluví automaticky.
- **Marodka:** při nemoci se série zastaví, nic se neztratí a hlášky zjemní.
- **Kalendář** posledních 5 týdnů (splněno, expres, marodka, žolík, dny s tréninkem).
- **Deník:** zápis tréninků (kickbox, funkční trénink, posilovna, běh, regenerace…) s délkou, pocitem a poznámkou, týdenní souhrn včetně regenerace.
- **Rekordy:** zápis výkonů (kg, opakování v kuse, sekundy, km), automatické poznání osobáku a historie pokusů.
- Vlastní denní cíle, ukázková data, export a import JSON, volitelná záloha na OneDrive.
- Instalace na plochu, offline režim, upozornění na novou verzi, světlý i tmavý režim.

## Použití

Statická stránka bez závislostí (`index.html`, `config.js`, `cloud.js`, `sw.js`, `manifest.webmanifest`, ikony), nasazená na GitHub Pages.
Nasazení, zálohu a ranní připomínku popisuje `NAVOD.md`, další kroky `PLAN.md`.

Při každé změně souborů zvyšte v `sw.js` číslo verze `CACHE`, aby si zařízení stáhla novou verzi a zobrazila upozornění.

## Soukromí

Data se ukládají v `localStorage` daného prohlížeče a volitelně se zálohují na váš OneDrive. Do repozitáře se nikdy nedostávají, repozitář obsahuje jen kód aplikace.
