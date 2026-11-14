# ROADMAP: Watch Later Button v2.0 — Единая архитектура (`src/`) и автоматизация сборки

> **Назначение документа:** Мастер-план и техническая спецификация для AI-агента (Antigravity 2.0) и разработчика по переводу проекта с ручной синхронизации (`chrome/` + `firefox/`) на единую кодовую базу (`src/`) с автоматизированной сборкой (`dist/`), шаблонизацией ссылок для магазинов и обновлением тестов.

---

## 0. Контекст и локальные скиллы агента

В репозитории установлены профильные скиллы в `.agents/skills/` (зафиксированы в `skills-lock.json`). При выполнении этапов этого плана использовать их правила:
* `.agents/skills/chrome-extensions/SKILL.md` — архитектура MV3, Service Worker, Content Scripts, Storage.
* `.agents/skills/chrome-webstore-release-blueprint/SKILL.md` — требования ревью CWS и AMO (чистота кода, отсутствие мертвых ссылок на чужие сторы).
* `.agents/skills/puppeteer-automation/SKILL.md` и `.agents/skills/javascript-typescript-jest/SKILL.md` — обновление E2E и i18n тестов.
* `.agents/skills/github-actions-templates/SKILL.md` — настройка CI/CD для релизов.

---

## 1. Сравнение текущей и целевой архитектуры

### Текущая проблема
Сейчас в репозитории лежат две почти идентичные папки: `chrome/` и `firefox/` (по 35+ файлов в каждой: 26 локалей, `assets/`, `pages/`, `popup/`, `js/saveto.js`, `background.js`). В корневом `package.json` скрипт `"sync"` копирует только `saveto.js` через Unix-команду `cp`, что приводит к:
1. Рассинхрону версий и метаданных между браузерными сборками.
2. Ручной правке ссылок на Chrome Web Store и Mozilla Add-ons в `popup/` и `pages/`.
3. Риску отклонения сборки модераторами Mozilla Add-ons (AMO) из-за упоминаний Chrome Web Store в HTML/JS.

### Целевая структура репозитория
```text
Watch-Later-button/
├── .agents/                    # Локальные скиллы и правила (без изменений)
├── .github/
│   ├── FUNDING.yml             # Спонсорство Buy Me a Coffee (без изменений)
│   └── workflows/
│       ├── deploy-docs.yml     # Деплой Jekyll-сайта из docs/ (без изменений)
│       └── release-ext.yml     # [NEW] Автосборка и проверка релизных .zip
├── banner/                     # Промо-материалы и скриншоты для сторов (не попадают в dist)
├── docs/                       # Независимый сайт watchlater.alxple.com на Jekyll (не попадает в dist)
├── scripts/
│   ├── build.mjs               # [NEW] Кроссплатформенный сборщик Chrome & Firefox
│   ├── devtools-relay.mjs      # Локальный коллектор DevTools (без изменений)
│   └── start-chrome-debug.sh   # Запуск отладочного профиля Chrome (обновить путь на dist/chrome)
├── src/                        # [NEW] ЕДИНЫЙ ИСХОДНЫЙ КОД РАСШИРЕНИЯ
│   ├── _locales/               # Все 26 локалей (ar .. zh_TW)
│   ├── assets/
│   │   ├── app-icons/red/      # Иконки 16, 32, 48, 120, 128
│   │   ├── fonts/              # inter-latin-400.woff2, inter-latin-500.woff2, manrope-latin-700.woff2
│   │   └── styles/
│   │       └── style.css       # Стили кнопки на YouTube (вкл. .wl-mount-relative)
│   ├── js/
│   │   └── saveto.js           # Единый content script (Player + Shorts + Cards, с cloneInto для Firefox)
│   ├── pages/
│   │   ├── pages.css           # Общие стили онбординга и обновлений
│   │   ├── pages.js            # Локализация и демо-кнопка
│   │   ├── update.html         # Шаблон страницы обновления с плейсхолдерами ссылок
│   │   └── welcome.html        # Шаблон приветственной страницы с плейсхолдерами ссылок
│   ├── popup/
│   │   ├── popup.css           # Стили попапа и настроек
│   │   ├── popup.html          # Шаблон попапа с плейсхолдерами ссылок и тумблерами
│   │   └── popup.js            # Единая логика попапа и синхронизации настроек
│   ├── background.js           # Единый фоновый скрипт (onInstalled -> welcome.html / update.html)
│   └── manifest.base.json      # Базовый манифест MV3 (общие поля + единый version)
├── dist/                       # [NEW, в .gitignore] Артефакты сборки
│   ├── chrome/                 # Распакованное расширение для Chrome / Edge
│   ├── firefox/                # Распакованное расширение для Firefox
│   ├── watch-later-chrome-v2.0.0.zip
│   └── watch-later-firefox-v2.0.0.zip
├── tests/
│   ├── check-locales-puppeteer.js  # Проверка всех 26 локалей на dist/chrome и dist/firefox
│   ├── e2e.test.js                 # E2E тесты YouTube (Watch, Shorts, Home, Search, Cards)
│   └── package.json
├── .gitignore                  # Добавить dist/ и *.zip
├── package.json                # Корневые npm-скрипты (build, test, test:locales, ci)
├── ROADMAP_V2_REFACTORING.md   # Этот план
├── README.md
└── SETUP.md
```

---

## 2. Пошаговый план миграции (Этапы для выполнения)

### Этап 1: Формирование единой папки `src/` и удаление дубликатов
- [x] Создать директорию `src/` на базе наиболее актуальной версии из `chrome/` (`_locales/`, `assets/`, `js/`, `pages/`, `popup/`, `background.js`).
- [x] Унифицировать `src/background.js`: использовать кроссбраузерный объект `const extAPI = globalThis.browser ?? globalThis.chrome;` для открытия `pages/welcome.html` при установке и `pages/update.html` при обновлении.
- [x] Проверить наличие в `src/assets/styles/style.css` класса для корректного позиционирования на карточках видео:
  ```css
  .wl-mount-relative {
    position: relative !important;
  }
  ```
- [x] Создать `src/manifest.base.json` без браузеро-специфичных полей (`background` и `browser_specific_settings` генерируются при сборке):
  - Единый автор: `"Oleksandr Pletnov"`.
  - Версия: `"1.6.4"`.
- [x] Удалить старые директории `chrome/` и `firefox/` после переноса и проверки всех файлов.

---

### Этап 2: Шаблонизация ссылок в `popup.html`, `welcome.html` и `update.html`
Чтобы модераторы AMO и CWS видели только релевантные для своего браузера ссылки, заменить захардкоженные URL магазина в HTML-файлах `src/` на плейсхолдеры:

| Плейсхолдер | Значение для `chrome` | Значение для `firefox` |
| :--- | :--- | :--- |
| `{{STORE_URL}}` | `https://chromewebstore.google.com/detail/watch-later-button/igehcnnhegiagilpnablldbbcnjabkab` | `https://addons.mozilla.org/firefox/addon/watchlaterbutton/` |
| `{{REVIEWS_URL}}` | `https://chromewebstore.google.com/detail/watch-later-button/igehcnnhegiagilpnablldbbcnjabkab/reviews` | `https://addons.mozilla.org/firefox/addon/watchlaterbutton/reviews/` |
| `{{SUPPORT_URL}}` | `https://chromewebstore.google.com/detail/watch-later-button/igehcnnhegiagilpnablldbbcnjabkab/support` | `https://watchlater.alxple.com/` |

- [x] **Файлы для шаблонизации:** `src/popup/popup.html`, `src/pages/welcome.html`, `src/pages/update.html`.
- [x] **Очистка JS:** Удалить из `src/popup/popup.js` и `src/pages/pages.js` runtime-подмену `href` через `isFirefox` — ссылки вшиваются статически на этапе сборки.

---

### Этап 3: Реализация сборочного скрипта `scripts/build.mjs` (Zero-Dependency)
Написать `scripts/build.mjs` на чистом Node.js (ES-модуль, без внешних npm-пакетов), который при запуске выполняет:

- [x] **Валидацию JSON:** Парсит `src/manifest.base.json` и все 26 файлов `src/_locales/*/messages.json`. При любой синтаксической ошибке немедленно завершает сборку с кодом `1` и путём к проблемному файлу.
- [x] **Очистку `dist/`:** Удаляет предыдущую папку `dist/` и создает `dist/chrome` и `dist/firefox`.
- [x] **Копирование и рендеринг HTML:** Рекурсивно копирует файлы из `src/` (исключая `manifest.base.json`, `.DS_Store`, `Thumbs.db`), подставляя плейсхолдеры `{{STORE_URL}}`, `{{REVIEWS_URL}}`, `{{SUPPORT_URL}}` во все `.html` файлы (`popup/popup.html`, `pages/welcome.html`, `pages/update.html`).
- [x] **Генерацию `manifest.json`:**
  - Для `dist/chrome/manifest.json`: добавляет `"background": { "service_worker": "background.js" }`.
  - Для `dist/firefox/manifest.json`: добавляет `"browser_specific_settings": { "gecko": { "id": "pletnov.alex@gmail.com", "data_collection_permissions": { "required": ["none"] } } }` и `"background": { "scripts": ["background.js"] }`.
- [x] **Проверку на утечку ссылок (Post-Build Lint):** Проверяет все `.html` и `.js` файлы в `dist/firefox/`, чтобы в них не встречалась подстрока `chromewebstore.google.com` и не оставалось нераскрытых токенов `{{...}}`.
- [x] **Кроссплатформенную упаковку в ZIP:**
  - На Windows (.NET `ZipFile` с нормализацией `/` для CWS и AMO).
  - На Linux/macOS: вызывает `zip -r -q`.
  - Поддерживает флаг `--no-zip`.
  - Итоговые архивы: `dist/watch-later-chrome-v<version>.zip` и `dist/watch-later-firefox-v<version>.zip`.

---

### Этап 4: Обновление тестов и конфигурации репозитория
- [x] **`tests/check-locales-puppeteer.js`:**
  - Заменить захардкоженный путь `../chrome` на `../dist/chrome` (с возможностью передать путь через CLI-аргумент или `EXTENSION_PATH`, чтобы прогонять проверку и на `dist/firefox`).
  - Заменить `/tmp` на изолированный `fs.mkdtempSync(os.tmpdir())` и кроссплатформенный поиск Chromium (включая кеш Puppeteer и системный Chrome), чтобы тесты одинаково работали на Windows 11 и Linux CI.
  - Расширить проверку на **все** 1378 элементов `[data-i18n]` в `popup/popup.html`, `pages/welcome.html` и `pages/update.html`.
  - Добавить проверку отсутствия горизонтального переполнения в попапе (`document.body.scrollWidth <= 320`) для всех 26 языков.
- [x] **`tests/e2e.test.js`:**
  - Обновить `extensionPath` на `path.join(__dirname, '..', 'dist', 'chrome')` и сделать кроссплатформенный запуск Chromium.
  - Добавить E2E-сценарий: проверка появления кнопки сохранения на карточке видео в результатах поиска (`/results?search_query=lofi`) при наведении курсора (`hover`), наличия `.wl-mount-relative` на контейнере и отсутствия перехода по ссылке при клике на кнопку.
- [x] **Корневые файлы:**
  - Обновить `.gitignore`: добавить `dist/` и `*.zip`.
  - Обновить корневой `package.json`: добавить `"build"`, `"build:fast"`, `"test"` (тесты локалей), `"test:locales"`, `"test:e2e"`, `"ci"`, `"chrome:debug"`.
  - Обновить `scripts/start-chrome-debug.sh` и добавить `scripts/start-chrome-debug.ps1` для Windows.
  - Актуализировать пути в `SETUP.md`.

---

### Этап 5: Функциональные улучшения релиза v2.0 (опционально после миграции)
После стабилизации новой структуры `src/` в рамках v2.0 можно добавить:
1. **Переключатели поверхностей в Popup (`storage.sync`):** тумблеры включения/отключения кнопки отдельно для страницы видео (`/watch`), Shorts (`/shorts`) и карточек видео с реактивным обновлением открытых вкладок через `storage.onChanged`.
2. **Отображение актуального хоткея в `title` кнопки на YouTube:** в `src/js/saveto.js` формировать подсказку динамически (например, `Watch Later (Alt + W)`), читая `currentShortcut.display` из `storage`.
3. **Расширенные наборы шрифтов (`latin-ext`, `cyrillic`):** добавить `.woff2` начертания для `Inter` и `Manrope` в `src/assets/fonts/`, чтобы кириллица и умлауты рендерились тем же шрифтом, что и латиница.
4. **Обновление сайта `docs/` и скриншотов `banner/`:** обновить скриншоты попапа и карточек в `banner/` и добавить релизный пост `docs/_posts/2026-11-XX-v2.0.0.md`.

---

## 3. Критерии приемки (Definition of Done)

- [x] В репозитории отсутствуют дублирующие папки `chrome/` и `firefox/`; весь исходный код хранится в `src/`.
- [x] Команда `npm run build` из корня репозитория успешно собирает `dist/chrome`, `dist/firefox` и два `.zip` архива на Windows 11 и Linux без установки дополнительных зависимостей.
- [x] В `dist/firefox/` полностью отсутствуют ссылки на `chromewebstore.google.com` во всех `.html`, `.js` и `.json` файлах, а в обоих таргетах не осталось нераскрытых токенов `{{...}}`.
- [x] Команда `npm run test:locales` проходит без ошибок по всем 26 локалям для `popup.html`, `pages/welcome.html` и `pages/update.html`.
- [x] E2E-тесты и тесты локалей поддерживают кроссплатформенный запуск.
- [x] Сайт в `docs/` и воркфлоу `.github/workflows/deploy-docs.yml` продолжают работать автономно без поломки путей.