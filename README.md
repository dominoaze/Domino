# Domino statistika: Cloudflare (Worker + D1)

## Mərhələ 1: API və baza (hazırdır)
Lokal sınaq (Node 20+ lazımdır):

    npm install
    cp .dev.vars.example .dev.vars      # açarları test üçün olduğu kimi saxlaya bilərsiniz
    npx wrangler d1 migrations apply DB --local
    npx wrangler dev --local            # bir terminalda
    npm test                            # digər terminalda, 14 test

Açarlar yalnız ASCII (latın hərfləri, rəqəmlər) olmalıdır.

## Rollar
- `x-group-key`: üzv (oyun əlavə edir, statistikanı görür)
- `x-admin-key`: admin (ləğv/redaktə, oyunçu idarəsi, tarixçə, CSV ixrac)

## Növbəti mərhələlər
2. Səhifə bu API-yə qoşulur  3. Claude rəyi  4. Backup (GitHub Actions)  5. Cloudflare-ə yerləşdirmə və domen  6. Köhnə datanın köçürülməsi
