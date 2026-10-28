# Spustenie v 6 krokoch — všetko iba GitHub

**Návštevníci nepotrebujú GitHub účet.** Otvoria stránku, vyberú deň, zadajú meno a spoločné heslo.

1. Prihlás sa na GitHub a vytvor **verejný** repozitár `40-dni-modlitieb` (na účte `adykub-3dee`).
2. Rozbaľ ZIP a do repozitára nahraj **všetky súbory a priečinky** z archívu (nie samotný ZIP). Over, že `index.html` je priamo v hlavnom priečinku.
3. GitHub → repozitár → **Settings → Pages → Deploy from a branch → main → /(root) → Save**. Web bude na `https://adykub-3dee.github.io/40-dni-modlitieb/`.
4. V GitHube vytvor **Fine-grained personal access token**: Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. **Repository access: Only select repositories → 40-dni-modlitieb.** Repository permissions: **Contents → Read and write**. Ostatné povolenia nechaj minimálne. Platnosť nastav do konca projektu.
5. Otvor stránku `https://adykub-3dee.github.io/40-dni-modlitieb/nastavenie.html`. Vlož token, zvoľ spoločné heslo (aspoň 12 znakov) a klikni **Vytvoriť šifrovaný auth.json**. Skopíruj výsledný JSON. Na GitHube otvor `data/auth.json` → ceruzka **Edit** → nahraď celý obsah vygenerovaným JSON → **Commit changes**.
6. Otvor hlavnú stránku, vyber dátum, zadaj testovacie meno a svoje heslo. Skontroluj na GitHube `data/records.json`, že sa meno uložilo. Po úspešnom teste môžeš poslať ľuďom **iba odkaz + heslo**.

**Hotovo.** Žiadne Firebase, Cloudflare, ďalšie účty ani inštalácie.

### Dôležité upozornenie

Toto je jednoduché dočasné riešenie, nie bezpečný prihlasovací server. Osoba so spoločným heslom môže získať odomknutý prístupový token a zmeniť **aj iné súbory v tomto repozitári**, nielen zápisy. Preto použi len samostatný repozitár, **nikdy** token s prístupom k ostatným projektom. Mená a námety vo verejnom repozitári sú verejne čitateľné, aj bez poznania adresy stránky. Token po skončení projektu zruš.

Podrobnosti: `README.md`.
