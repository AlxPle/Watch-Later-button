const puppeteer = require('puppeteer');
const path = require('path');

// Путь к директории с вашим расширением
const extensionPath = path.join(__dirname, 'chrome');

// URL видео на YouTube для теста
const YOUTUBE_VIDEO_URL = 'https://www.youtube.com/watch?v=PRgS7hBgR1k';

// Селектор для кнопки, которую добавляет ваше расширение.
// ВАЖНО: Этот селектор - предположение. Вам нужно будет заменить его
// на реальный ID или класс, который вы присваиваете кнопке в saveto.js.
const WATCH_LATER_BUTTON_SELECTOR = '#saveToPlaylist';

describe('Watch Later Button E2E Test', () => {
  let browser;
  let page;

  // Увеличиваем стандартный таймаут Jest, т.к. запуск браузера и загрузка страницы могут быть долгими
  jest.setTimeout(30000);

  beforeAll(async () => {
    // Запускаем браузер Chromium
    browser = await puppeteer.launch({
      headless: true, // Установите 'true' для запуска в фоновом режиме
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    // Создаем новую страницу
    page = await browser.newPage();
  });

  afterAll(async () => {
    // Закрываем браузер после всех тестов
    await browser.close();
  });

  test('should inject the "Watch Later" button on a YouTube video page', async () => {
    // 1. Переходим на страницу видео
    await page.goto(YOUTUBE_VIDEO_URL, { waitUntil: 'domcontentloaded' });

    // 2. Ждем, пока кнопка появится на странице.
    // Puppeteer будет ждать до 30 секунд, пока элемент не станет доступен.
    const button = await page.waitForSelector(WATCH_LATER_BUTTON_SELECTOR);

    // 3. Проверяем, что элемент (кнопка) был найден.
    // Если waitForSelector не найдет элемент, он выбросит ошибку, и тест провалится.
    // Эта проверка добавляет наглядности.
    expect(button).not.toBeNull();
  });
});