# Инструкция по установке зависимостей

## Системные требования

Убедитесь, что у вас установлены:
- Ruby
- Node.js и npm
- Git

## Установка системных зависимостей

### 1. Установка инструментов разработки (Fedora/CentOS/RHEL)
```bash
sudo dnf install ruby-devel gcc gcc-c++ make openssl-devel
```

## Установка Bundler и Jekyll напрямую

Если Bundler или Jekyll не установлены, выполните:
```bash
gem install bundler jekyll
```

## Установка зависимостей проекта

### 2. Ruby gems (Jekyll и темы)
```bash
bundle install
```

**Что устанавливается:**
- `jekyll` (~4.3) - генератор статических сайтов
- `minima` (~2.5) - тема Jekyll
- `jekyll-seo-tag` - плагин для SEO оптимизации

### 3. Node.js зависимости (тестирование)
```bash
npm install
```

## Запуск проекта

### Запуск Jekyll сайта
```bash
bundle exec jekyll serve
```

### Запуск тестов
```bash
npm test
```

## Структура проекта

- `chrome/` - исходный код Chrome расширения
- `_posts/` - статьи для Jekyll блога
- `_layouts/` - шаблоны Jekyll
- `_sass/` - стили SCSS
- `assets/` - статические файлы (CSS, изображения)
- `package.json` - Node.js зависимости
- `Gemfile` - Ruby gems зависимости

## Полезные команды

```bash
# Проверка версий
ruby --version
node --version
npm --version
bundle --version

# Сборка сайта без запуска сервера
bundle exec jekyll build

# Очистка сгенерированных файлов
bundle exec jekyll clean
```