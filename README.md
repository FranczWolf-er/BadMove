# BadMove

Drzá motivační aplikace na každodenní pohyb: denní cíle, série, deník tréninků a osobní rekordy.

- **Dnes:** denní cíle (ranní protažení, dřepy, kliky, břicho a záda, procházka) s plnou a expres verzí. Obojí drží sérii.
- **Série se žolíkem:** jeden vynechaný den za týden se omluví automaticky.
- **Marodka:** při nemoci se série zastaví, nic se neztratí a hlášky zjemní.
- **Kalendář** posledních 5 týdnů (splněno, expres, marodka, žolík, dny s tréninkem).
- **Deník:** zápis tréninků (kickbox, funkční trénink, posilovna, běh, regenerace…) s délkou, kilometry (běh, procházka…) a poznámkou, úprava i smazání zápisu, týdenní souhrn včetně km a regenerace. Měsíční a roční přehled s grafem minut a rozpadem podle druhu.
- **Plán na týden:** tréninky podle dnů (kickbox út/čt, funkční so…), samy se odškrtnou zápisem do deníku, na Dnes tlačítko Odcvičeno. Splnění plánu v měsíčním a ročním přehledu.
- **Rekordy:** zápis výkonů (kg, opakování v kuse, sekundy, km, čas min:s), u času „méně je lépe“. Automatické poznání osobáku, historie pokusů s úpravou a graf pokroku u každého cviku.
- **Knihovna:** vlastní druhy tréninku (název, obvyklá délka, popis, regenerační, s kilometry), ze kterých se vybírá v deníku. Přejmenování se propíše i do deníku.
- Vlastní denní cíle, ukázková data, export a import JSON, záloha na OneDrive nebo Google Disk.
- Instalace na plochu, offline režim, upozornění na novou verzi, světlý i tmavý režim.

## Použití

Statická stránka bez závislostí (`index.html`, `config.js`, `cloud.js`, `sw.js`, `manifest.webmanifest`, ikony), nasazená na GitHub Pages.
Nasazení, zálohu a ranní připomínku popisuje `NAVOD.md`, další kroky `PLAN.md`.

Při každé změně souborů zvyšte v `sw.js` číslo verze `CACHE`, aby si zařízení stáhla novou verzi a zobrazila upozornění.

## Soukromí

Data se ukládají v `localStorage` daného prohlížeče a volitelně se zálohují na váš OneDrive. Do repozitáře se nikdy nedostávají, repozitář obsahuje jen kód aplikace.
