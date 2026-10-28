# 40 dní modlitieb – iba GitHub Pages + spoločné heslo

Spoločný modlitebný kalendár 9. 11. – 18. 12. 2026. Všetko funguje **iba v jednom verejnom GitHub repozitári**: webová stránka, fotografia, databáza mien aj modlitebných námetov. Žiadny Firebase, Cloudflare, Google Sheets, vlastný server ani npm.

**Pre návštevníka:** otvorí URL, vyberie si deň, napíše meno, zadá spoločné heslo a klikne na Uložiť. Údaje sa zapíšu bez GitHub účtu, bez prechodu na inú stránku. Rovnako možno upravovať a rušiť zápisy a spravovať námety.

**Pre organizátora:** jednorazovo vytvorí repozitár, obmedzený GitHub token a jeho šifrovanú podobu v súbore `data/auth.json`. Token sa **nikdy neukladá do repozitára v otvorenom tvare**. Každý návštevník, ktorý zadá spoločné heslo, si ho môže v prehliadači dešifrovať a aplikácia následne zapíše JSON cez GitHub REST API.

## Najjednoduchší postup

Podrobný postup v šiestich krokoch je v **[START-TU.md](START-TU.md)**. Potom ľuďom pošli len URL a heslo.

1. Vytvor verejný repozitár `adykub-3dee/40-dni-modlitieb` a nahraj obsah ZIP archívu. `index.html`, `config.js`, `nastavenie.html`, `data` a `assets` musia byť v koreňovom adresári / príslušných podpriečinkoch.
2. Zapni GitHub Pages: **Settings → Pages → Deploy from a branch → main → /(root)**.
3. V nastaveniach GitHub účtu vytvor **Fine-grained personal access token**. Zvoľ **Only select repositories**, priraď **iba** `40-dni-modlitieb`, permission **Contents: Read and write**, platnosť napr. do 31. 12. 2026. Nevytváraj klasický token s prístupom ku všetkým repozitárom.
4. Otvor `https://adykub-3dee.github.io/40-dni-modlitieb/nastavenie.html`, vlož token, vyber vlastné nové heslo (aspoň 12 znakov), klikni vytvoriť `auth.json`.
5. V repozitári otvor `data/auth.json` a nahraď jeho pôvodný obsah výsledkom z formulára. Potvrď **Commit changes**.
6. Otvor `https://adykub-3dee.github.io/40-dni-modlitieb/` a vyskúšaj zápis. V súbore `data/records.json` sa objaví meno. Hotovo.

### Z čoho sa projekt skladá

| Súbor | Účel |
|---|---|
| `index.html`, `style.css` | Pekný responzívny web s fotografiou kostola |
| `assets/kostol.webp` | Optimalizovaná dodaná fotografia |
| `js/app.mjs` | Kalendár, formuláre, námety, denné zvýrazňovanie |
| `js/core.mjs` | Výpočet 40 dní, dátum podľa Europe/Bratislava |
| `js/github-store.mjs` | GitHub API, kontrola SHA, konflikty, šifrované prihlásenie |
| `config.js` | Nastavenie názvu repozitára a obnovenia |
| `data/records.json` | **Živá spoločná databáza** mien a námetov |
| `data/auth.json` | Šifrovaný GitHub token (po jednorazovom nastavení) |
| `nastavenie.html` | Generátor šifrovaného `auth.json`, údaje nespracúva žiadny backend |
| `tests/` | Automatické testy |
| `.github/workflows/validate.yml` | GitHub Actions na automatické overenie zmien |

## Používanie

- Rozpis môže prezerať ktokoľvek bez hesla. Obsadené dni sú zelené, aktuálny deň zvýraznený, neobsadené voľné.
- Používateľ sa môže zapísať na neobsadený súčasný alebo budúci deň. Uplynulé dni sú na nové zápisy zatvorené. Aj starý zápis sa dá upraviť alebo zrušiť.
- Po zadaní hesla sa prehliadač odomkne až do obnovenia či zatvorenia stránky. **Token zostáva iba v pamäti stránky**, nie v localStorage, sessionStorage ani cookies.
- Námety možno pridávať, upravovať, vymazávať. Zoznam sa všetkým obnovuje podľa `config.js` každé 2 minúty a po návrate na kartu.
- Pri dvoch súčasných zápisoch aplikácia používa kontrolu SHA a automaticky opakuje kolidujúcu operáciu. **Druhý zápis na už obsadený deň odmietne**, namiesto tichého prepísania.
- Pri chybe pripojenia nevydáva aplikácia zápis za úspešný, zobrazí chybu.
- Každá zmena súboru `data/records.json` vytvára commit v histórii repozitára. Stav sa dá z GitHub histórie obnoviť.

## Bezpečnosť a obmedzenia – dôležité

To, že ľudia nemusia mať GitHub účet, funguje len preto, že existuje **spoločný obmedzený GitHub token**. Šifrovanie skrýva token pred človekom bez hesla, ale **neoddeľuje práva návštevníka od práv tokenu**. Človek so spoločným heslom si môže token zistiť v prehliadači a priamo cez API meniť súbory v priradenom repozitári. Šifrovanie hesla na klientovi je zároveň náchylné na offline skúšanie hesiel. Nejde o plnohodnotný bezpečný backend.

Pre tento dočasný projekt:

- **Vyhraď výhradne jeden samostatný repozitár** a **Fine-grained PAT** iba s `Contents: Read and write` preň; nijaký všeobecný/classic token.
- Použi **nové dostatočne dlhé spoločné heslo**, nie pôvodné heslo z ukážkového React kódu.
- **Nedávaj osobné alebo citlivé modlitebné úmysly** do databázy: repozitár je verejný, obsah `data/records.json` uvidí hocikto na GitHube. Skrytie URL, `noindex` a heslo nechránia obsah pred čítaním.
- Token nenechávaj priamo ako reťazec v `config.js` či v inom verejnom súbore. GitHub môže takéto tokeny odhaliť a zneplatniť.
- Po skončení projektu token **revokuj** v GitHub Settings → Personal access tokens. Odstráň staré zápisy podľa potreby (pozor: Git história ich môže zachovať aj po vymazaní).
- Repozitár nepoužívaj na iné dôležité súbory, lebo návštevník s heslom má k nim technicky zápisové oprávnenie.
- GitHub Pages nie je databázový server. GitHub API má limity, front-end sa automaticky obnovuje v intervaloch, zmeny nie sú skutočne realtime a po každej zmene môže prebehnúť nové Pages nasadenie.

Ak by bolo potrebné skutočne bezpečné jediné heslo bez sprístupnenia repozitára, nie je to technicky možné iba na GitHub Pages — treba samostatný backend.

## Testovanie

Ak máš Node.js 22+, spusti v priečinku projektu:

```bash
node --test tests/*.test.mjs
```

Testuje sa kalendár, slovenský čas, diakritika, prihlasovacie šifrovanie, obsadenie a úprava zápisu, námety aj súbežné zápisy s konfliktom SHA. GitHub Actions spustí testy automaticky.

Testy sú simulované; **skutočný zápis do tvojho repozitára je možné otestovať až po vytvorení tokenu a nahratí `data/auth.json`**. Token nikomu neposielaj, ani do chatu.

## Často kladené otázky

**Môžem zmeniť heslo?** Áno. Otvor znova `nastavenie.html`, vlož ten istý alebo nový GitHub token, zadaj nové heslo a nahraď `data/auth.json`.

**Musia mať účastníci GitHub účty?** Nie. GitHub účet potrebujete vy, jednorazovo na vytvorenie repozitára a tokenu.

**Je to bezplatné?** V bežnom rozsahu dočasného projektu možno používať verejný GitHub repozitár a GitHub Pages bezplatne; uplatňujú sa limity GitHub API a Pages.

**Čo ak sa neukladá?** Skontroluj v repozitári existenciu `data/records.json`, povolenie tokenu `Contents: Read and write`, čas platnosti tokenu, a či bol šifrovaný `data/auth.json` nahraný na hlavnej vetve. V prípade neúspechu uvidíš chybovú hlášku na stránke.
