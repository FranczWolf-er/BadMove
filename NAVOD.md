# BadMove – nasazení, záloha (OneDrive, Google Disk) a připomínka

## 1. GitHub Pages
Repozitář `BadMove` → Settings → Pages → Source: *Deploy from a branch*, větev `main`, složka `/ (root)` → Save.
Za minutu běží aplikace na `https://franczwolf-er.github.io/BadMove/` (včetně lomítka na konci).

## 2. Instalace na iPhone
1. Otevři adresu v Safari → Sdílet → **Přidat na plochu**.
2. Spouštěj ji z plochy. Aplikace z plochy má na iPhonu **vlastní úložiště**, odděleně od Safari.

## 3. Záloha na OneDrive
Aplikace má vlastní registraci **BadMove** v Microsoft Entra (client ID je v `config.js`). Postup, kdyby bylo potřeba ji založit znovu:
1. https://entra.microsoft.com → Identity → Applications → **App registrations** → **New registration**.
2. Name `BadMove`, Supported account types: *Accounts in any organizational directory and personal Microsoft accounts*,
   Redirect URI: platforma **Single-page application (SPA)**, hodnota `https://franczwolf-er.github.io/BadMove/` → Register.
3. Zkopíruj **Application (client) ID**.
4. API permissions → Add a permission → Microsoft Graph → Delegated → `Files.ReadWrite.AppFolder` a `offline_access` → Add.
5. Vlož ID do `config.js` (`clientId: '…'`), zvyš verzi v `sw.js` a ulož (commit).
6. V aplikaci: ⚙ → **Připojit OneDrive**. Záloha leží v `Apps/BadMove/badmove-backup.json`.

Dokud `clientId` chybí, záloha je vypnutá a data se dají uložit exportem (⚙ → Uložit export).

## 3b. Záloha na Google Disk (jednorázově)
Pro uživatele s účtem Google. Záloha leží ve skrytých datech aplikace na Disku Google (v Disku ji neuvidíš, aplikace nevidí nic jiného).
1. Otevři https://console.cloud.google.com a vytvoř nový projekt `BadMove`.
2. **APIs & Services → Library** → vyhledej **Google Drive API** → **Enable**.
3. **Google Auth Platform** (dříve OAuth consent screen) → **Get started**: název aplikace `BadMove`, e-mail podpory,
   Audience **External**, kontaktní e-mail → Create.
4. **Data Access** → Add or remove scopes → přidej `.../auth/drive.appdata` → Update → Save.
5. **Audience → Test users** → přidej svůj účet Google a účty kamarádů, kteří budou zálohovat (v testovacím režimu až 100).
6. **Clients → Create client** → typ **Web application**, název `BadMove`:
   - Authorized JavaScript origins: `https://franczwolf-er.github.io`
   - Authorized redirect URIs: `https://franczwolf-er.github.io/BadMove/`
   → Create a zkopíruj **Client ID** (končí na `.apps.googleusercontent.com`).
7. Vlož ho do `config.js` (`googleClientId: '…'`), zvyš verzi v `sw.js` a ulož (commit).
8. V aplikaci: ⚙ → **Připojit Google Disk** → vyber účet a potvrď oprávnění.

Přihlášení ke Google vydrží asi hodinu. Pak se nahoře ukáže „Přihlášení vypršelo“ a klepnutí na **Přihlásit**
ho obnoví (obvykle bez hesla). Změny mezitím zůstávají v zařízení a zazálohují se po přihlášení.
Zálohuje se vždy do jednoho úložiště. Přepnout jde odpojením a připojením druhého, data se sloučí.

## 4. Ranní připomínka přes Zkratky (iPhone)
Webová aplikace zatím sama připomínky neposílá. Do té doby to zvládne iPhone:
1. Aplikace **Zkratky** → Automatizace → **+** → **Denní čas** → např. 7:00, opakovat denně → **Spustit okamžitě**.
2. Akce **Zobrazit oznámení** s textem třeba „Gauč tě miluje. Nenech se.“
3. Volitelně přidej akci **Otevřít URL** s adresou aplikace.

## Když něco nejde
- `AADSTS50011` (redirect URI): adresa v registraci se musí přesně shodovat s adresou aplikace, včetně `/BadMove/`.
- `AADSTS700016` / neplatný client ID: zkontroluj `config.js`.
- Google `redirect_uri_mismatch`: adresa v Authorized redirect URIs se musí přesně shodovat, včetně `/BadMove/`.
- Google `access_denied` / „aplikace není ověřená“: přidej účet mezi Test users (krok 3b.5).
- Nová verze se nenačítá: zvyš číslo `CACHE` v `sw.js`, aplikace pak nahoře nabídne **Obnovit**.
