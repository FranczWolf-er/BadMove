# BadMove – nasazení, záloha a připomínka

## 1. GitHub Pages
Repozitář `BadMove` → Settings → Pages → Source: *Deploy from a branch*, větev `main`, složka `/ (root)` → Save.
Za minutu běží aplikace na `https://franczwolf-er.github.io/BadMove/` (včetně lomítka na konci).

## 2. Instalace na iPhone
1. Otevři adresu v Safari → Sdílet → **Přidat na plochu**.
2. Spouštěj ji z plochy. Aplikace z plochy má na iPhonu **vlastní úložiště**, odděleně od Safari.

## 3. Záloha na OneDrive (volitelné, jednorázově)
Princip je stejný jako u BadGuns, jen s vlastní registrací:
1. https://entra.microsoft.com → Identity → Applications → **App registrations** → **New registration**.
2. Name `BadMove`, Supported account types: *Accounts in any organizational directory and personal Microsoft accounts*,
   Redirect URI: platforma **Single-page application (SPA)**, hodnota `https://franczwolf-er.github.io/BadMove/` → Register.
3. Zkopíruj **Application (client) ID**.
4. API permissions → Add a permission → Microsoft Graph → Delegated → `Files.ReadWrite.AppFolder` a `offline_access` → Add.
5. Vlož ID do `config.js` (`clientId: '…'`), zvyš verzi v `sw.js` a ulož (commit).
6. V aplikaci: ⚙ → **Připojit OneDrive**. Záloha leží v `Apps/BadMove/badmove-backup.json`.

Dokud `clientId` chybí, záloha je vypnutá a data se dají uložit exportem (⚙ → Uložit export).

## 4. Ranní připomínka přes Zkratky (iPhone)
Webová aplikace zatím sama připomínky neposílá. Do té doby to zvládne iPhone:
1. Aplikace **Zkratky** → Automatizace → **+** → **Denní čas** → např. 7:00, opakovat denně → **Spustit okamžitě**.
2. Akce **Zobrazit oznámení** s textem třeba „Gauč tě miluje. Nenech se.“
3. Volitelně přidej akci **Otevřít URL** s adresou aplikace.

## Když něco nejde
- `AADSTS50011` (redirect URI): adresa v registraci se musí přesně shodovat s adresou aplikace, včetně `/BadMove/`.
- `AADSTS700016` / neplatný client ID: zkontroluj `config.js`.
- Nová verze se nenačítá: zvyš číslo `CACHE` v `sw.js`, aplikace pak nahoře nabídne **Obnovit**.
