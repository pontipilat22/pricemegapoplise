# Инструкция по развертыванию на Railway

## Предварительные требования

1. Аккаунт на [Railway.app](https://railway.app)
2. Установленный Git
3. Аккаунт на GitHub (рекомендуется)

## Шаг 1: Подготовка репозитория

### Вариант А: Через GitHub (рекомендуется)

1. Создайте новый репозиторий на GitHub
2. Загрузите код проекта:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/ВАШ_ЮЗЕРНЕЙМ/pricemegapolis.git
git push -u origin main
```

### Вариант Б: Через Railway CLI

1. Установите Railway CLI:
```bash
npm install -g @railway/cli
```

2. Авторизуйтесь:
```bash
railway login
```

## Шаг 2: Создание проекта на Railway

### Через веб-интерфейс (если используете GitHub):

1. Зайдите на [railway.app](https://railway.app)
2. Нажмите "New Project"
3. Выберите "Deploy from GitHub repo"
4. Авторизуйте Railway для доступа к вашему GitHub
5. Выберите репозиторий `pricemegapolis`

### Через CLI:

```bash
railway new
# Выберите "Empty Project"
```

## Шаг 3: Настройка переменных окружения

В Railway Dashboard:

1. Откройте ваш проект
2. Перейдите в раздел "Variables"
3. Добавьте следующие переменные:

```
SESSION_SECRET=вашсекретныйключдлясессийизменитеего12345
PORT=3000
NODE_ENV=production
```

Опционально (для email уведомлений):
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_TO=admin@example.com
```

## Шаг 4: Добавление постоянного хранилища (Volume)

1. В Railway Dashboard откройте ваш проект
2. Нажмите "New" → "Volume"
3. Назовите volume: `data`
4. Mount path: `/data`
5. Прикрепите volume к вашему сервису

## Шаг 5: Развертывание

### Если используете GitHub:
Проект автоматически развернется после push в main ветку.

### Если используете CLI:

```bash
railway up
```

## Шаг 6: Настройка домена

1. В Railway Dashboard перейдите в Settings вашего сервиса
2. В разделе "Domains" нажмите "Generate Domain"
3. Railway создаст домен вида: `yourproject.up.railway.app`

## Важные моменты

### База данных
- SQLite база данных будет храниться в volume по пути `/data/database.db`
- При первом запуске создастся администратор по умолчанию:
  - Логин: `admin`
  - Пароль: `admin123`
  - **ОБЯЗАТЕЛЬНО смените пароль после первого входа!**

### Загруженные файлы
- Изображения товаров сохраняются в `/data/uploads`
- Они будут сохраняться между перезапусками благодаря volume

### Мониторинг
- Логи доступны в Railway Dashboard
- Следите за использованием ресурсов в разделе "Metrics"

## Обновление приложения

1. Внесите изменения в код
2. Закоммитьте и отправьте на GitHub:

```bash
git add .
git commit -m "Описание изменений"
git push
```

3. Railway автоматически развернет обновления

## Решение проблем

### Приложение не запускается
- Проверьте логи в Railway Dashboard
- Убедитесь, что все переменные окружения установлены
- Проверьте, что volume правильно подключен

### База данных сбрасывается
- Убедитесь, что volume подключен с mount path `/data`
- Проверьте переменную `RAILWAY_VOLUME_MOUNT_PATH` в логах

### Изображения не загружаются
- Проверьте права доступа к папке uploads
- Убедитесь, что volume имеет достаточно места

## Бесплатный план Railway

На бесплатном плане Railway предоставляет:
- $5 кредитов в месяц
- 500 часов работы
- 1GB RAM
- 1GB дискового пространства

Для небольшого магазина этого должно хватить.

## Поддержка

При возникновении проблем:
1. Проверьте логи в Railway Dashboard
2. Обратитесь в поддержку Railway
3. Проверьте документацию Railway: https://docs.railway.app
