# Неделя 3 · Express — структура и middleware

> Ты написал роутер и middleware руками. Теперь разберём, как это сделано в Express — и почему фреймворк нужен даже тем, кто понимает, что под капотом.

---

## Содержание

1. [Express: что это и как работает под капотом](#1-express-что-это-и-как-работает-под-капотом)
2. [Middleware: цепочка, next() и порядок](#2-middleware-цепочка-next-и-порядок)
3. [Routing: Router, параметры, вложенные роуты](#3-routing-router-параметры-вложенные-роуты)
4. [Error Handling Middleware](#4-error-handling-middleware)
5. [Валидация с zod](#5-валидация-с-zod)
6. [Environment variables (.env)](#6-environment-variables-env)
7. [Структура Express-проекта](#7-структура-express-проекта)
8. [🎯 Шпаргалка для собеседования](#8-шпаргалка-для-собеседования)
9. [✅ Чек-поинт](#9-чек-поинт)
10. [Практика](#10-практика)

---

## 1. Express: что это и как работает под капотом

### TL;DR

Express — это тонкая обёртка над `node:http`, которая даёт три вещи: **middleware pipeline**, **routing** и **удобный API** (req.params, req.body, res.json). Внутри — тот же `http.createServer`, но с правильной абстракцией. Ты уже написал обе части руками — теперь увидишь, как Express делает то же самое, но продуманнее.

### ⏭ Что пропустить

Ты написал `Router` с regex-паттернами и `createApp()` с цепочкой middleware. Тебе **не нужно** заново учить:
- Что такое `req` и `res` — ты уже работаешь с `IncomingMessage` и `ServerResponse`
- Что такое middleware как концепт — ты реализовал `loggerMiddleware`, `jsonParserMiddleware`, `corsMiddleware`
- Как работает `next()` — ты написал функцию `handle()` с замыканием на `index`

Фокус этой недели — **чем Express отличается от твоей реализации** и что он добавляет сверху.

### Что такое Express — точное определение

Express — это **минималистичный фреймворк**, построенный на двух библиотеках:

| Зависимость | Что делает | Твой аналог из Week 2 |
|---|---|---|
| **`path-to-regexp`** | Конвертирует `/users/:id` в RegExp | Твой метод `addRoute()` в `router.ts` |
| **`finalhandler`** | Обрабатывает ошибки, если ни один middleware не ответил | Твоя проверка `if (!middleware) return` |

Express сам по себе **не добавляет** body parsing, CORS, авторизацию. Всё это — отдельные middleware-пакеты (`express.json()`, `cors`, `helmet`). Express = **ядро pipeline + routing**.

### Как Express работает внутри

Когда ты пишешь `const app = express()`, вот что происходит:

```
┌──────────────────────────────────────────────────────────────┐
│                     express()                                │
│                                                              │
│  1. Создаёт объект app (он же — функция!)                    │
│  2. app хранит массив middleware (app._router.stack)         │
│  3. app(req, res) === app.handle(req, res)                   │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ http.createServer(app)                                │   │
│  │                                                       │   │
│  │ На каждый запрос Node.js вызывает app(req, res)       │   │
│  │ → Express расширяет req и res прототипами             │   │
│  │ → запускает цепочку middleware из stack                │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Ключевой инсайт:** `app` — это **функция** `(req, res, next) => void`, которая передаётся в `http.createServer()`. Точно как твоя `app.handle` — но Express делает `app` вызываемым напрямую.

### 🔗 Сравнение: твой код vs Express

Твой Week 2 сервер:

```ts
// Ты написал руками:
const app = createApp()           // создаёшь pipeline
app.use(corsMiddleware)           // добавляешь middleware
app.use(loggerMiddleware)
app.use(jsonParserMiddleware)
app.use((req, res) => { ... })    // финальный обработчик

const server = createServer((req, res) => {
  app.handle(req as RouteRequest, res)  // вручную вызываешь
})
```

Express-эквивалент:

```ts
import express from 'express'

const app = express()              // то же самое, но app сам является функцией
app.use(cors())                    // готовый пакет вместо твоей функции
app.use(express.json())            // встроенный json parser
app.get('/users', (req, res) => {  // routing + handler в одном вызове
  res.json(users)
})

app.listen(3000)                   // внутри вызывает http.createServer(app)
```

### Что Express добавляет к req и res

Express **расширяет** стандартные `IncomingMessage` и `ServerResponse`. Ты делал это через `RouteRequest extends IncomingMessage` — Express делает то же, но через **прототип**.

#### req (Request) — расширения:

| Свойство/метод | Что делает | Твой аналог |
|---|---|---|
| `req.params` | Параметры из URL (`/users/:id` → `{ id: '42' }`) | `req.params` — ты добавлял вручную |
| `req.query` | Query string (`?page=2` → `{ page: '2' }`) | Ты парсил `url.split('?')` |
| `req.body` | Распарсенный body (нужен middleware) | `req.body` — ты добавлял в `jsonParserMiddleware` |
| `req.path` | Путь без query string | Ты делал `url.split('?')[0]` |
| `req.get(header)` | Получить заголовок (case-insensitive) | `req.headers['content-type']` |
| `req.ip` | IP клиента (с учётом proxy) | `req.socket.remoteAddress` |

#### res (Response) — расширения:

| Метод | Что делает | Твой аналог |
|---|---|---|
| `res.json(data)` | `res.setHeader('Content-Type', 'application/json') + res.end(JSON.stringify(data))` | Ты писал это каждый раз руками |
| `res.status(code)` | Устанавливает статус, возвращает `res` для цепочки | `res.writeHead(code, headers)` |
| `res.send(data)` | Универсальный отправщик (string → text/html, object → json, Buffer → octet-stream) | Нет аналога |
| `res.redirect(url)` | 302 редирект | Нет аналога |
| `res.set(header, val)` | Установить заголовок | `res.setHeader(header, val)` |

> **Важно:** `res.json()` делает три вещи: устанавливает `Content-Type: application/json`, вызывает `JSON.stringify()` с правильной обработкой `undefined` и `null`, и вызывает `res.end()`. Ты делал это каждый раз в каждом обработчике — Express убирает дублирование.

### res.json() vs res.send() — в чём разница

На собеседовании спрашивают. Разница тонкая, но важная:

```ts
// res.json({ name: 'Dzmitry' })
// 1. Ставит Content-Type: application/json
// 2. Вызывает JSON.stringify(data)
// 3. Вызывает res.send() с результатом

// res.send({ name: 'Dzmitry' })
// 1. Видит объект → вызывает JSON.stringify
// 2. Ставит Content-Type: application/json
// 3. Вычисляет Content-Length
// 4. Отправляет
```

Для объектов результат одинаковый. Но `res.json()` **явнее** (explicit), и с ним есть бонус:

```ts
// res.json() корректно обрабатывает:
res.json(null)      // → "null" (валидный JSON)
res.json(undefined) // → "null" (undefined не валиден в JSON)
res.json(0)         // → "0"
res.json(false)     // → "false"

// res.send() с этими значениями может вести себя иначе:
res.send(null)      // → '' (пустое тело, status 200)
res.send(undefined) // → '' (пустое тело)
```

**Правило:** для API всегда используй `res.json()`. `res.send()` — для HTML или plain text.

### Установка и настройка

```bash
npm install express
npm install -D @types/express
```

> ⚠ `@types/express` — это **типы**, не рантайм-зависимость. В `devDependencies`, не в `dependencies`. Express написан на JavaScript, типы — community-maintained пакет.

Минимальный сервер:

```ts
import express from 'express'

const app = express()

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Express' })
})

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
})
```

Это эквивалентно ~40 строкам твоего кода из Week 2. Express не делает ничего магического — просто хорошо спроектированная абстракция.

### app.listen() — что внутри

Когда ты вызываешь `app.listen(3000)`, Express делает ровно это:

```ts
// Псевдокод внутри Express:
app.listen = function(port, callback) {
  const server = http.createServer(this) // this = app (функция)
  return server.listen(port, callback)
}
```

`app.listen()` **возвращает** `http.Server` — тебе нужен этот объект для graceful shutdown:

```ts
const server = app.listen(3000) // Сохраняй!

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Shutdown complete')
    process.exit(0)
  })
})
```

### 🎯 На собесе

**Q: Чем Express отличается от чистого http.createServer?**

❌ «Express — это фреймворк для веб-серверов»

✅ «Express — тонкая обёртка над `http.createServer()`. Он добавляет три вещи: middleware pipeline (цепочка обработчиков через `next()`), routing (через `path-to-regexp`) и расширенные `req`/`res` объекты (req.params, req.body, res.json, res.status). Внутри app — это функция `(req, res) => void`, которая передаётся в `createServer`. Express не добавляет body parsing, cors, auth — это всё отдельные middleware.»

**Q: Что возвращает `express()`?**

✅ «Возвращает функцию `app`, совместимую с `http.createServer(app)`. Эта функция одновременно является объектом с методами `.get()`, `.use()`, `.listen()` и т.д. Когда приходит HTTP-запрос, Node.js вызывает `app(req, res)`, Express расширяет req/res через прототип и запускает middleware stack.»

---

## 2. Middleware: цепочка, next() и порядок

### Суть в 5 предложениях

Middleware — это функция с сигнатурой `(req, res, next) => void`. Каждый middleware решает: **обработать запрос и ответить** (тогда `next()` не вызывается) или **передать дальше** (вызвать `next()`). Порядок `app.use()` — это порядок выполнения, он **критичен**. Express различает 5 типов middleware, но под капотом все они — функции с одинаковой сигнатурой. Ты уже реализовал эту систему в Week 2 — теперь разберём, что Express добавляет сверху.

### 🔗 Твоя реализация vs Express

Твой `createApp()` из Week 2:

```ts
// middleware.ts — твоя реализация
function handle(req, res) {
  let index = 0

  function next(err?: Error): void {
    if (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ error: err.message }))
      return
    }
    const middleware = middlewares[index++]
    if (!middleware) return // Конец цепочки
    try {
      middleware(req, res, next)
    } catch (e) {
      next(e as Error)
    }
  }

  next() // Запуск цепочки
}
```

Express делает **то же самое**, но с тремя дополнениями:

1. **Path matching** — middleware можно привязать к конкретному пути (`app.use('/api', ...)`), не только глобально
2. **Router layer** — middleware организуются в слои (`Layer`), каждый с паттерном пути и ссылкой на функцию
3. **Error middleware** — отдельная сигнатура `(err, req, res, next)` с **четырьмя** аргументами

### Порядок выполнения — визуализация

```
Запрос: POST /api/users

app.use(cors())                    ──── 1️⃣ CORS headers ──→ next()
app.use(express.json())            ──── 2️⃣ Parse body    ──→ next()
app.use(loggerMiddleware)          ──── 3️⃣ Log start     ──→ next()
app.use('/api', apiRouter)         ──── 4️⃣ Path match    ──→ next() внутри роутера
  └─ router.post('/users', handler) ── 5️⃣ Route match   ──→ res.json(...)
                                                              ↓
app.use(errorHandler)              ──── ⛔ НЕ вызван (ответ уже отправлен)
```

**Критичные правила порядка:**

| Правило | Почему |
|---|---|
| `cors()` — первый | Preflight (OPTIONS) должен ответить ДО body parsing |
| `express.json()` — до роутов | Иначе `req.body` будет `undefined` в обработчиках |
| Роуты — в середине | Они обрабатывают запросы |
| Error handler — **последний** | Ловит ошибки из всех предыдущих middleware |

> **На проде это ломается так:** разработчик ставит `express.json()` после роутов. Все POST-запросы приходят с `req.body === undefined`. Баг молчаливый — нет ошибки, просто пустое тело. Отладка занимает часы, потому что логи не показывают проблему.

### app.use() vs app.get() / app.post()

Это часто путают. Разница принципиальная:

```ts
// app.use() — middleware для ЛЮБОГО метода
app.use('/api', (req, res, next) => {
  // Вызывается для GET /api/..., POST /api/..., DELETE /api/... — ЛЮБОЙ метод
  // Путь сравнивается как ПРЕФИКС: /api/users тоже сматчится
  next()
})

// app.get() — middleware ТОЛЬКО для GET + ТОЧНОЕ совпадение пути
app.get('/api/users', (req, res) => {
  // Вызывается ТОЛЬКО для GET /api/users
  // НЕ вызывается для GET /api/users/123
  res.json(users)
})
```

**Ключевое отличие — matching:**

| | `app.use(path, fn)` | `app.get(path, fn)` |
|---|---|---|
| HTTP метод | **Любой** | Только GET |
| Path matching | **Префикс** (`/api` матчит `/api/users/123`) | **Точный** (`/api/users` НЕ матчит `/api/users/123`) |
| Назначение | Кросс-cutting concern (logging, auth, parsing) | Конкретный route handler |
| `req.path` | Путь **после** prefix (если `/api` → req.path = `/users`) | Полный путь |

Пример с отсечением префикса:

```ts
app.use('/api', (req, res, next) => {
  // Запрос: GET /api/users/42
  console.log(req.url)    // '/users/42' — Express отрезал '/api'!
  console.log(req.baseUrl) // '/api'
  console.log(req.originalUrl) // '/api/users/42' — оригинальный URL
  next()
})
```

> **Это важно понимать.** Когда ты передаёшь Router через `app.use('/api', router)`, внутри роутера `req.url` будет **без** `/api`. Express отрезает matched prefix. Это не баг — это design decision, позволяющий роутерам быть независимыми от точки монтирования.

### 5 типов middleware в Express

Express формально выделяет 5 типов. Под капотом — это всё функции `(req, res, next)`, но классификация помогает понять архитектуру.

#### 1. Application-level middleware

Привязан к `app`:

```ts
// Для всех маршрутов
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
})

// Для конкретного пути (префикс!)
app.use('/admin', (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
})
```

#### 2. Router-level middleware

Привязан к `express.Router()`. Работает так же, как application-level, но с ограниченной областью видимости:

```ts
const router = express.Router()

// Middleware только для этого роутера
router.use((req, res, next) => {
  console.log('Router-level middleware')
  next()
})

router.get('/users', handler)

app.use('/api', router)
```

Подробнее о Router — в [разделе 3](#3-routing-router-параметры-вложенные-роуты).

#### 3. Error-handling middleware

**Единственное отличие — 4 аргумента.** Express определяет тип middleware по `function.length`:

```ts
// Обычный middleware — 3 аргумента
app.use((req, res, next) => { ... })

// Error middleware — 4 аргумента (ВСЕ 4 ОБЯЗАТЕЛЬНЫ!)
app.use((err, req, res, next) => { ... })
```

Подробнее в [разделе 4](#4-error-handling-middleware).

#### 4. Built-in middleware

Express 4.x/5.x имеет три встроенных middleware (не нужно ставить отдельно):

```ts
// 1. JSON body parser — аналог твоего jsonParserMiddleware
app.use(express.json())

// 2. URL-encoded body parser — для HTML-форм
app.use(express.urlencoded({ extended: true }))

// 3. Статические файлы
app.use(express.static('public'))
```

`express.json()` vs твой `jsonParserMiddleware`:

| | Твоя реализация | `express.json()` |
|---|---|---|
| Content-Type check | `contentType?.includes('application/json')` | То же + поддержка charset |
| Size limit | `MAX_BODY_SIZE = 1024 * 1024` | `{ limit: '100kb' }` по умолчанию |
| Encoding | Только UTF-8 | Определяет по `Content-Type` charset |
| Strict mode | Нет | `{ strict: true }` — только объекты и массивы |
| Reviver | Нет | Поддерживает `JSON.parse` reviver |

> **Важно:** `express.json()` по умолчанию ограничивает body **100 КБ**. На проде часто нужно увеличить: `express.json({ limit: '1mb' })`. Но не ставь слишком много — это защита от DoS.

`express.urlencoded({ extended: true })` — зачем нужен:

```ts
// HTML форма отправляет: name=Dzmitry&email=dzmitry%40omnia.dev
// Content-Type: application/x-www-form-urlencoded

app.use(express.urlencoded({ extended: true }))

app.post('/login', (req, res) => {
  // req.body = { name: 'Dzmitry', email: 'dzmitry@omnia.dev' }
})
```

`extended: true` использует библиотеку `qs` — поддерживает вложенные объекты (`user[name]=Dzmitry`).
`extended: false` использует `querystring` — только плоские значения.

> Для API (JSON) это обычно не нужно. Но если ты строишь сервер, принимающий HTML-формы (логин, загрузка файлов) — нужно.

#### 5. Third-party middleware

Устанавливаются через npm. Самые частые на проде (и на собесах):

| Пакет | Что делает | Когда ставить |
|---|---|---|
| `cors` | CORS-заголовки | Всегда для API |
| `helmet` | Security-заголовки (CSP, HSTS, X-Frame) | Всегда на проде |
| `morgan` | HTTP-логирование | Dev + Prod |
| `compression` | gzip/brotli | Prod (если нет Nginx перед Express) |
| `cookie-parser` | Парсит cookies в `req.cookies` | Когда нужны cookies |
| `express-rate-limit` | Rate limiting | Auth endpoints |

Пример подключения:

```ts
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

app.use(helmet())                    // Security headers — ПЕРВЫМ
app.use(cors({ origin: 'https://omnia.dev' })) // CORS
app.use(morgan('combined'))          // Логирование
app.use(express.json())              // Body parsing
```

### next() — три способа вызова

```ts
app.use((req, res, next) => {
  // 1. next() — передать следующему middleware
  next()

  // 2. next(err) — передать в error handler
  next(new Error('Something broke'))

  // 3. next('route') — пропустить оставшиеся callbacks ЭТОГО route,
  //    перейти к следующему route
  next('route')
})
```

`next('route')` — менее известная, но полезная возможность:

```ts
// Несколько callbacks на одном route
app.get('/users/:id',
  (req, res, next) => {
    // Первый callback: проверка
    if (req.params.id === '0') {
      return next('route') // Пропустить второй callback, перейти к следующему app.get
    }
    next() // Перейти ко второму callback
  },
  (req, res) => {
    // Второй callback: основная логика
    res.json({ id: req.params.id })
  }
)

app.get('/users/:id', (req, res) => {
  // Этот route сработает, если первый вызвал next('route')
  res.json({ id: '0', name: 'System User' })
})
```

### Подводный камень: async middleware

Express 4 **НЕ ловит** ошибки из async-функций:

```ts
// ⛔ ОПАСНО — Express 4 не поймает ошибку!
app.get('/users', async (req, res) => {
  const users = await db.getUsers() // Если упадёт — unhandled rejection
  res.json(users)
})

// ✅ ПРАВИЛЬНО — оборачиваем в try/catch
app.get('/users', async (req, res, next) => {
  try {
    const users = await db.getUsers()
    res.json(users)
  } catch (err) {
    next(err) // Передаём в error handler
  }
})
```

> ⚠ **Express 5** (сейчас в beta) будет автоматически ловить rejected promises. Но на 2026 большинство проектов всё ещё на Express 4. На собесе упомяни эту разницу — покажет глубину знаний.

Чтобы не писать `try/catch` в каждом обработчике, используй обёртку:

```ts
// Утилита asyncHandler — пишется один раз
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

// Использование — чисто и безопасно
app.get('/users', asyncHandler(async (req, res) => {
  const users = await db.getUsers()
  res.json(users)
}))
```

### 🎯 На собесе

**Q: Что такое middleware в Express?**

✅ «Middleware — это функция с сигнатурой `(req, res, next)`. Express организует их в стек: каждый middleware либо отвечает клиенту (тогда `next()` не вызывается), либо передаёт управление дальше через `next()`. Порядок `app.use()` = порядок выполнения. Error-handling middleware имеет 4 аргумента `(err, req, res, next)` — Express определяет его по `function.length`. Middleware бывают application-level, router-level, error-handling, built-in и third-party.»

**Q: Почему порядок middleware важен?**

✅ «Потому что middleware выполняются строго последовательно. Если поставить `express.json()` после роутов — `req.body` будет `undefined`. Если поставить CORS после auth guard — preflight OPTIONS вернёт 401. Error handler должен быть последним, потому что он ловит ошибки из всех предыдущих middleware.»

**Q: Как Express обрабатывает async ошибки?**

✅ «Express 4 не ловит rejected promises автоматически. Если async handler бросит ошибку без try/catch — произойдёт unhandled rejection и сервер может упасть. Решение: обернуть в try/catch и вызвать `next(err)`, либо использовать утилиту `asyncHandler` которая делает `.catch(next)`. Express 5 исправляет это — автоматически ловит rejected promises.»

---

## 3. Routing: Router, параметры, вложенные роуты

### Суть

Express Router — это «мини-приложение», которое умеет только routing и middleware. Ты монтируешь его через `app.use(path, router)`. Это позволяет **разбить** большое приложение на модули: `/users` — один файл, `/workspaces` — другой. Каждый модуль не знает, к какому префиксу он будет примонтирован.

### 🔗 Твой Router vs Express Router

Твой `Router` из Week 2:

```ts
// router.ts — Week 2
const router = new Router()
router.get('/users', handler)
router.get('/users/:id', handler)

// В server.ts ты вручную вызывал:
app.use((req, res) => {
  const result = router.match(method, url)
  if (!result) { res.writeHead(404); res.end(); return }
  req.params = result.params
  result.handler(req, res)
})
```

Express Router:

```ts
import { Router } from 'express'

const router = Router()
router.get('/users', handler)
router.get('/users/:id', handler)

// Монтирование — Express сам делает match + params
app.use('/api', router)
```

Разница:
- Тебе не нужно вручную вызывать `match()` и присваивать `params`
- Router знает свой mounted path через `req.baseUrl`
- Router — полноценный middleware, его можно вкладывать в другие роутеры

### Создание и структура Router

```ts
// src/routes/users.ts
import { Router } from 'express'

const router = Router()

// Middleware только для этого роутера
router.use((req, res, next) => {
  console.log(`Users router: ${req.method} ${req.url}`)
  next()
})

// Роуты — пути ОТНОСИТЕЛЬНО точки монтирования
router.get('/', (req, res) => {
  // Если router примонтирован к /api/users,
  // этот handler обрабатывает GET /api/users
  res.json(users)
})

router.get('/:id', (req, res) => {
  // GET /api/users/42 → req.params.id === '42'
  const user = users.find(u => u.id === req.params.id)
  if (!user) return res.status(404).json({ error: 'Not found' })
  res.json(user)
})

router.post('/', (req, res) => {
  // POST /api/users
  const { name, email } = req.body
  // ...создание пользователя
  res.status(201).json(newUser)
})

export default router
```

```ts
// src/app.ts
import express from 'express'
import usersRouter from './routes/users.js'
import workspacesRouter from './routes/workspaces.js'

const app = express()

app.use(express.json())

// Монтируем роутеры к префиксам
app.use('/api/users', usersRouter)
app.use('/api/workspaces', workspacesRouter)

export default app
```

### Параметры маршрута

Express использует библиотеку `path-to-regexp` для парсинга путей. Она мощнее твоей regex-реализации:

```ts
// Простой параметр — как у тебя
router.get('/users/:id', handler)
// GET /users/42 → req.params = { id: '42' }

// Несколько параметров
router.get('/workspaces/:workspaceId/members/:memberId', handler)
// GET /workspaces/abc/members/123
// → req.params = { workspaceId: 'abc', memberId: '123' }

// Опциональный параметр (суффикс ?)
router.get('/users/:id/posts/:postId?', handler)
// GET /users/42/posts      → req.params = { id: '42', postId: undefined }
// GET /users/42/posts/7    → req.params = { id: '42', postId: '7' }
```

> **Важно:** `req.params` всегда содержит **строки**. Даже если ID — число, `req.params.id` будет `'42'`, не `42`. На проде ты парсишь и валидируешь: `parseInt(req.params.id, 10)` или через zod. Ошибка «сравниваю string с number» — классическая.

### Query string

Query string парсится Express автоматически:

```ts
// GET /users?page=2&limit=10&sort=name
router.get('/users', (req, res) => {
  console.log(req.query)
  // { page: '2', limit: '10', sort: 'name' }
  // Все значения — СТРОКИ!

  const page = parseInt(req.query.page as string, 10) || 1
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100)
})
```

### router.param() — предобработка параметров

Полезный механизм: выполнить код **до** обработчика, если в URL есть конкретный параметр:

```ts
router.param('id', (req, res, next, id) => {
  // Вызывается для ЛЮБОГО роута с :id в этом роутере
  const user = users.find(u => u.id === id)
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }
  req.user = user // Прикрепляем найденного пользователя
  next()
})

// Теперь в обработчиках не нужно искать user — он уже в req.user
router.get('/:id', (req, res) => {
  res.json(req.user)
})

router.put('/:id', (req, res) => {
  Object.assign(req.user, req.body)
  res.json(req.user)
})

router.delete('/:id', (req, res) => {
  // req.user гарантированно существует
  users.splice(users.indexOf(req.user), 1)
  res.sendStatus(204)
})
```

Это убирает дублирование `users.find()` + `if (!user)` из каждого обработчика.

### Вложенные роутеры

Роутеры вкладываются друг в друга. Это паттерн для сложных API:

```ts
// routes/workspaces.ts
const workspacesRouter = Router()

// routes/members.ts
const membersRouter = Router({ mergeParams: true })
// ↑ mergeParams: true — чтобы :workspaceId был доступен внутри membersRouter

membersRouter.get('/', (req, res) => {
  // GET /api/workspaces/abc/members
  const { workspaceId } = req.params // Доступен благодаря mergeParams
  res.json(getMembersByWorkspace(workspaceId))
})

membersRouter.post('/', (req, res) => {
  // POST /api/workspaces/abc/members
  const { workspaceId } = req.params
  // ...добавить участника
})

// Монтируем вложенный роутер
workspacesRouter.use('/:workspaceId/members', membersRouter)

// В app.ts:
app.use('/api/workspaces', workspacesRouter)
```

Результат:
```
GET  /api/workspaces/:workspaceId/members      → membersRouter '/'
POST /api/workspaces/:workspaceId/members      → membersRouter '/'
GET  /api/workspaces/:workspaceId/members/:id  → membersRouter '/:id'
```

> `mergeParams: true` — без него `req.params.workspaceId` будет `undefined` внутри `membersRouter`, потому что по умолчанию каждый роутер имеет свою область видимости параметров.

### Route chaining — app.route()

Для одного пути с разными методами — чтобы не повторять путь:

```ts
// Вместо:
router.get('/users', getUsers)
router.post('/users', createUser)

// Можно:
router.route('/users')
  .get(getUsers)
  .post(createUser)

router.route('/users/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser)
```

Чисто стилистическое — поведение идентичное. Но на ревью смотрится аккуратнее.

### 🎯 На собесе

**Q: Что такое Router в Express?**

✅ «Router — это изолированный экземпляр middleware и routes. По сути это "мини-приложение", которое не умеет listen, но умеет всё остальное: middleware, routes, param processing. Его монтируют к основному app через `app.use(prefix, router)`. Это позволяет разбить API на модули — каждый модуль не знает свой финальный prefix, что делает его переиспользуемым.»

**Q: Что такое `mergeParams` и зачем он нужен?**

✅ «По умолчанию каждый Router имеет свою область параметров. Если вложенный роутер примонтирован через `router.use('/:parentId/children', childRouter)`, то внутри `childRouter` параметр `:parentId` недоступен. `mergeParams: true` при создании дочернего роутера объединяет параметры родителя и ребёнка в один `req.params`.»

---

## 4. Error Handling Middleware

### Суть

Error handling — это **единственная** тема, где Express отличается от стандартного middleware принципиально. Обычный middleware имеет 3 аргумента: `(req, res, next)`. Error middleware — **4 аргумента**: `(err, req, res, next)`. Express определяет тип middleware по `function.length`. Если аргументов 4 — это error handler. Если 3 — обычный.

> **Это критично:** если ты напишешь error handler с 3 аргументами (например, забудешь `next`) — Express будет считать его обычным middleware. Ошибки пролетят мимо. Баг молчаливый, отладка мучительная.

### Как ошибки попадают в error handler

```
┌─────────────────────────────────────────────────────────────┐
│ Два пути попадания ошибки в error handler:                  │
│                                                             │
│ 1. Явный вызов next(err) из любого middleware               │
│    app.get('/users', (req, res, next) => {                  │
│      next(new Error('DB connection failed'))                │
│    })                                                       │
│                                                             │
│ 2. Синхронный throw внутри middleware                        │
│    app.get('/users', (req, res) => {                        │
│      throw new Error('Unexpected') // Express поймает       │
│    })                                                       │
│                                                             │
│ ⚠ НЕ работает для async throw в Express 4!                  │
│    async (req, res) => { throw ... } — НЕ будет поймано     │
│    Нужен try/catch + next(err) или asyncHandler             │
└─────────────────────────────────────────────────────────────┘
```

### Базовый error handler

```ts
// Минимальный — для начала
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal Server Error' })
})
```

Проблемы минимального подхода:
1. Все ошибки возвращают 500 — клиент не знает, что пошло не так
2. В логи пишется stack trace, но без контекста (какой endpoint, какой user)
3. На проде stack trace может утечь к клиенту

### Production-ready error handler

На проде error handling состоит из **двух частей**: кастомные классы ошибок + централизованный handler.

#### Шаг 1: Класс AppError

```ts
// src/errors/AppError.ts
export class AppError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational

    // Фикс цепочки прототипов при наследовании от Error в TS
    Object.setPrototypeOf(this, new.target.prototype)

    // Убираем конструктор из stack trace
    Error.captureStackTrace(this, this.constructor)
  }
}

// Удобные фабрики
export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`, 404)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403)
  }
}
```

**Зачем `isOperational`?** Это разделение ошибок на два типа:

| Тип | Пример | Что делать |
|---|---|---|
| **Operational** (`isOperational = true`) | 404, 400, 401, rate limit | Ожидаемая ошибка — вернуть клиенту понятный ответ |
| **Programming** (`isOperational = false`) | TypeError, null reference | Баг — залогировать, вернуть 500, может перезапустить процесс |

```ts
// Operational — ожидаемая:
throw new NotFoundError('User', '42')  // isOperational = true

// Programming — баг:
const user = null
user.name // TypeError — isOperational нет, это не AppError
```

#### Шаг 2: Централизованный handler

```ts
// src/middleware/errorHandler.ts
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../errors/AppError.js'

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction  // ← ВСЕ 4 аргумента ОБЯЗАТЕЛЬНЫ, даже если next не используется
): void {
  // 1. Определяем тип ошибки
  if (err instanceof AppError) {
    // Operational error — отвечаем клиенту
    res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
    })
    return
  }

  // 2. Programming error — логируем и отвечаем 500
  console.error('💥 Unexpected error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  })

  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'       // Prod: скрываем детали
      : err.message,                  // Dev: показываем для отладки
    statusCode: 500,
  })
}
```

#### Шаг 3: Использование

```ts
// app.ts
import express from 'express'
import { errorHandler } from './middleware/errorHandler.js'
import { NotFoundError } from './errors/AppError.js'
import usersRouter from './routes/users.js'

const app = express()

app.use(express.json())
app.use('/api/users', usersRouter)

// 404 для несуществующих маршрутов — ПОСЛЕ всех роутов
app.use((req, res, next) => {
  next(new NotFoundError('Route', req.originalUrl))
})

// Error handler — ПОСЛЕДНИМ
app.use(errorHandler)
```

```ts
// routes/users.ts
router.get('/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id)
  if (!user) {
    throw new NotFoundError('User', req.params.id)
    // Express поймает throw и передаст в errorHandler
  }
  res.json(user)
})
```

### 🔗 Сравнение с твоим error handling из Week 2

Твоя реализация:

```ts
// middleware.ts — Week 2
function next(err?: Error): void {
  if (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }))
    return
  }
  // ...
}
```

Что было хорошо:
- Ты ловил ошибки через `try/catch` в `handle()` — правильный паттерн
- Поддержка `next(err)` — как в Express

Что Express добавляет:
- **Разделение** обычных и error middleware по сигнатуре
- **Классы ошибок** с кодами (404, 400, 401) вместо универсального 500
- **Operational vs Programming** ошибки — разные стратегии обработки

### Подводный камень: «Проглоченная» ошибка

```ts
// ⛔ ЧАСТАЯ ОШИБКА — забыли next в error handler
app.use((err: Error, req: Request, res: Response) => {  // 3 аргумента!
  res.status(500).json({ error: err.message })
})
// Express видит 3 аргумента → это ОБЫЧНЫЙ middleware, не error handler!
// Ошибки НЕ попадут сюда

// ✅ ПРАВИЛЬНО — все 4 аргумента
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({ error: err.message })
})
```

> Если `next` не используется в теле — TypeScript может предупредить об unused variable. Добавь `// eslint-disable-next-line @typescript-eslint/no-unused-vars` или назови `_next`. Но **не удаляй аргумент** — Express перестанет считать это error handler.

### 🎯 На собесе

**Q: Напиши error handling middleware для Express.**

✅ Сигнатура `(err, req, res, next)` — 4 аргумента. Express определяет error handler по `function.length === 4`. Operational ошибки (AppError) возвращают свой statusCode. Programming ошибки — 500 + логирование. На проде скрываем stack trace от клиента.

**Q: Что произойдёт, если в async route handler бросить ошибку без try/catch?**

✅ В Express 4 — unhandled promise rejection. Error handler НЕ вызовется. Сервер может упасть или зависнуть (запрос не получит ответ). Решение: `asyncHandler` обёртка или try/catch с `next(err)`.

---

## 5. Валидация с zod

### Зачем валидация на бэкенде

Фронтенд-валидация — это UX. Бэкенд-валидация — это **безопасность**. Клиент может отправить что угодно: пустое тело, строку вместо числа, SQL-инъекцию в email поле. **Никогда не доверяй входным данным.**

Твой Week 2 подход:

```ts
// server.ts — ручная проверка
if (!body || typeof body.name !== 'string' || typeof body.email !== 'string') {
  res.writeHead(400)
  res.end(JSON.stringify({ error: 'name and email are required' }))
  return
}
```

Проблемы:
1. **Многословно** — на каждый endpoint по 5–10 строк валидации
2. **Нет типизации** — TypeScript не знает тип `body` после проверки
3. **Нет деталей** — клиент получает одну строку ошибки, не знает какое именно поле неправильное
4. **Дублирование** — одну и ту же проверку email пишешь в нескольких местах

### Что такое zod

Zod — это библиотека **schema validation** для TypeScript. Ты описываешь схему данных, zod проверяет данные и **выводит TypeScript-тип** из схемы. Один источник правды: схема = и валидация, и типы.

```bash
npm install zod
```

### Базовые схемы

```ts
import { z } from 'zod'

// Схема = описание ожидаемой формы данных
const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
})

// TypeScript ТИП выводится из схемы — не нужно писать interface
type CreateUserDto = z.infer<typeof createUserSchema>
// → { name: string; email: string }
```

> 🔗 **Аналогия из фронтенда:** Если ты использовал PropTypes в React — zod это то же самое, но для рантайма и с типизацией. Если использовал TypeScript interfaces — zod добавляет к ним рантайм-валидацию.

### Типы данных в zod

```ts
// Примитивы
z.string()                     // string
z.number()                     // number (не NaN, не Infinity)
z.boolean()                    // boolean
z.date()                       // Date

// Строки с проверками
z.string().min(1)              // непустая строка
z.string().max(255)            // до 255 символов
z.string().email()             // email
z.string().url()               // URL
z.string().uuid()              // UUID v4
z.string().regex(/^[a-z]+$/)   // кастомный паттерн
z.string().trim()              // отрезает пробелы ПЕРЕД валидацией

// Числа
z.number().int()               // целое число
z.number().positive()          // > 0
z.number().min(1).max(100)     // диапазон

// Опциональные
z.string().optional()          // string | undefined
z.string().nullable()          // string | null
z.string().default('guest')    // если undefined → 'guest'

// Литералы и enum
z.literal('admin')             // только 'admin'
z.enum(['owner', 'admin', 'member']) // union литералов

// Массивы
z.array(z.string())            // string[]
z.array(z.string()).min(1)     // непустой массив
z.array(z.string()).max(10)    // максимум 10 элементов
```

### Объекты и вложенность

```ts
const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers and hyphens'),
  description: z.string().max(500).optional(),
  settings: z.object({
    isPublic: z.boolean().default(false),
    maxMembers: z.number().int().positive().default(50),
  }).optional(),
})

type CreateWorkspaceDto = z.infer<typeof createWorkspaceSchema>
// {
//   name: string
//   slug: string
//   description?: string
//   settings?: { isPublic: boolean; maxMembers: number }
// }
```

### Парсинг vs проверка

Zod имеет два метода:

```ts
// .parse() — бросает ZodError при неудаче
try {
  const user = createUserSchema.parse(req.body)
  // user типизирован как CreateUserDto
} catch (err) {
  if (err instanceof z.ZodError) {
    // err.errors — массив ошибок
  }
}

// .safeParse() — НЕ бросает, возвращает union
const result = createUserSchema.safeParse(req.body)

if (!result.success) {
  // result.error — ZodError
  console.log(result.error.errors)
  // [{ path: ['email'], message: 'Invalid email format', code: 'invalid_string' }]
} else {
  // result.data — типизированные данные
  const user = result.data // CreateUserDto
}
```

> **Правило:** в middleware используй `.safeParse()` — он не бросает исключений, ты контролируешь flow. `.parse()` хорош для скриптов и тестов, где исключение = провал.

### Validation middleware

Паттерн: middleware-фабрика, которая принимает zod-схему и возвращает middleware:

```ts
// src/middleware/validate.ts
import { z, ZodSchema } from 'zod'
import type { Request, Response, NextFunction } from 'express'

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      })
      return
    }

    // Перезаписываем body парсированными данными
    // (zod мог трансформировать: .trim(), .default(), .transform())
    req.body = result.data
    next()
  }
}
```

Использование:

```ts
// routes/users.ts
import { validate } from '../middleware/validate.js'
import { createUserSchema, updateUserSchema } from '../schemas/user.js'

router.post('/', validate(createUserSchema), (req, res) => {
  // req.body гарантированно валиден и типизирован!
  const { name, email } = req.body
  // ...создание пользователя
})

router.put('/:id', validate(updateUserSchema), (req, res) => {
  // ...обновление
})
```

### Валидация params и query

Тело — не единственное, что нужно валидировать:

```ts
// Расширенная версия validate middleware
interface ValidateOptions {
  body?: ZodSchema
  params?: ZodSchema
  query?: ZodSchema
}

export function validate(schemas: ValidateOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: { source: string; field: string; message: string }[] = []

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body)
      if (!result.success) {
        errors.push(...result.error.errors.map(e => ({
          source: 'body',
          field: e.path.join('.'),
          message: e.message,
        })))
      } else {
        req.body = result.data
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params)
      if (!result.success) {
        errors.push(...result.error.errors.map(e => ({
          source: 'params',
          field: e.path.join('.'),
          message: e.message,
        })))
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query)
      if (!result.success) {
        errors.push(...result.error.errors.map(e => ({
          source: 'query',
          field: e.path.join('.'),
          message: e.message,
        })))
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ error: 'Validation failed', details: errors })
      return
    }

    next()
  }
}

// Использование:
const paramsSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
})

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

router.get('/',
  validate({ query: querySchema }),
  (req, res) => {
    // req.query.page и req.query.limit — числа, уже распарсены!
  }
)

router.get('/:id',
  validate({ params: paramsSchema }),
  (req, res) => {
    // req.params.id — гарантированно UUID
  }
)
```

> **`z.coerce.number()`** — ключевой приём для query params. `req.query.page` всегда приходит как строка `"2"`. `z.coerce.number()` автоматически сконвертирует строку в число перед валидацией. Без `coerce` — `z.number()` упадёт с ошибкой, потому что `"2"` — не number.

### Схемы: переиспользование и композиция

```ts
// src/schemas/user.ts

// Базовая схема — общие поля
const userBase = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().trim().toLowerCase(),
})

// Create — все поля обязательны
export const createUserSchema = userBase

// Update — все поля опциональны (partial)
export const updateUserSchema = userBase.partial()
// → { name?: string; email?: string }

// Ответ API — добавляем id и timestamps
export const userResponseSchema = userBase.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

// Типы выводятся из схем
export type CreateUserDto = z.infer<typeof createUserSchema>
export type UpdateUserDto = z.infer<typeof updateUserSchema>
export type UserResponse = z.infer<typeof userResponseSchema>
```

Методы композиции:

| Метод | Что делает |
|---|---|
| `.partial()` | Все поля → optional |
| `.required()` | Все поля → required |
| `.extend({ ... })` | Добавить поля |
| `.pick({ name: true })` | Оставить только указанные |
| `.omit({ password: true })` | Убрать указанные |
| `.merge(otherSchema)` | Объединить с другой схемой |

### 🎯 На собесе

**Q: Зачем валидация на бэкенде, если фронтенд уже валидирует?**

✅ «Фронтенд-валидация — это UX, чтобы пользователь видел ошибку до отправки. Бэкенд-валидация — это безопасность. Запрос может прийти не из браузера: curl, Postman, другой сервис, атакующий. API должен защищать себя сам. Валидация на фронте может быть обойдена — на бэкенде нет.»

**Q: Зачем zod, если можно проверить `typeof req.body.name === 'string'`?**

✅ «Ручная валидация не масштабируется: на каждый endpoint 5–10 строк if/else, нет переиспользования, нет типизации после проверки. Zod решает три проблемы одновременно: рантайм-валидация, TypeScript-типы из схемы (`z.infer`), и переиспользование через `.partial()`, `.extend()`, `.pick()`. Одна схема = и валидация, и тип.»

---

## 6. Environment variables (.env)

### Зачем

Любое приложение имеет **конфигурацию**, которая различается между окружениями:

| Переменная | Dev | Prod |
|---|---|---|
| `PORT` | `3000` | `8080` (Railway/Render задаёт) |
| `DATABASE_URL` | `postgres://localhost/omnia_dev` | `postgres://user:pass@prod-host/omnia` |
| `JWT_SECRET` | `dev-secret-123` | `a8f3k2...` (длинный рандом) |
| `NODE_ENV` | `development` | `production` |

Конфигурация **не должна** быть в коде. Причины:
1. **Безопасность** — пароли не попадут в git
2. **Гибкость** — один и тот же код работает в dev, staging, prod
3. **12-Factor App** — стандарт индустрии (фактор III: Config)

### dotenv

```bash
npm install dotenv
```

Создай файл `.env` в корне проекта:

```env
# .env — НИКОГДА не коммитить!
PORT=3000
NODE_ENV=development
JWT_SECRET=dev-secret-change-in-production
DATABASE_URL=postgres://localhost:5432/omnia_dev
```

```env
# .env.example — КОММИТИТЬ (шаблон для команды)
PORT=3000
NODE_ENV=development
JWT_SECRET=
DATABASE_URL=
```

Загрузка:

```ts
// src/app.ts — в самом верху файла, ДО всего остального
import 'dotenv/config'
// или:
// import dotenv from 'dotenv'
// dotenv.config()

// Теперь process.env.PORT === '3000'
```

> **Важно:** `import 'dotenv/config'` должен быть **первой строкой** в entry point файле. Если ты импортируешь модуль, который читает `process.env` до загрузки dotenv — переменные будут `undefined`.

### Типизация process.env

По умолчанию `process.env.PORT` имеет тип `string | undefined`. Каждое обращение требует проверки. Решение — модуль конфигурации:

```ts
// src/config.ts
import 'dotenv/config'

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: requireEnv('JWT_SECRET'),
  databaseUrl: requireEnv('DATABASE_URL'),
} as const

// Теперь:
// config.port — number (не string | undefined)
// config.jwtSecret — string (не string | undefined)
// Приложение упадёт при старте если переменных нет — fail fast
```

### Валидация env через zod

Профессиональный подход — валидировать env через zod:

```ts
// src/config.ts
import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
})

// Парсим process.env — приложение упадёт при старте если что-то не так
const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data

// config.PORT — number
// config.NODE_ENV — 'development' | 'production' | 'test'
// config.JWT_SECRET — string (гарантированно >= 32 символа)
```

> **Принцип fail fast.** Если конфигурация невалидна — приложение должно упасть **сразу при старте**, не через 3 часа когда первый запрос дойдёт до JWT-верификации. `process.exit(1)` — правильное поведение.

### .gitignore — обязательно

```gitignore
# .gitignore
.env
.env.local
.env.*.local
!.env.example
```

> **Никогда** не коммить `.env`. Даже в dev. Даже «временно». Если секрет попал в историю git — он скомпрометирован навсегда (можно достать из любого коммита). Нужно его ротировать.

### 🎯 На собесе

**Q: Как управлять конфигурацией в Node.js приложении?**

✅ «Environment variables через `process.env`. В dev — загружаем из `.env` файла через dotenv. На проде — переменные задаются через платформу (Railway, Docker, Kubernetes). Файл `.env` никогда не коммитится — только `.env.example` как шаблон. Обязательно валидировать env при старте (zod или manual check): если нет `DATABASE_URL` — приложение должно упасть сразу, а не через час. Это принцип fail fast.»

---

## 7. Структура Express-проекта

### Почему структура важна

В Week 2 весь сервер — в одном файле `server.ts`. Для учебного проекта это нормально. На проде 5 000+ строк в одном файле — катастрофа для поддержки. Express не навязывает структуру (в отличие от NestJS), поэтому нужно выбрать самому.

### Рекомендуемая структура для Omnia

```
src/week3/
├── app.ts                    # Express app: middleware, роуты, error handler
├── server.ts                 # Entry point: dotenv, listen, graceful shutdown
├── config.ts                 # Конфигурация (env + zod валидация)
│
├── routes/
│   ├── users.ts              # Router для /users
│   └── health.ts             # Router для /health
│
├── middleware/
│   ├── errorHandler.ts       # Централизованный error handler
│   ├── validate.ts           # Validation middleware (zod)
│   └── logger.ts             # HTTP-логирование
│
├── schemas/
│   └── user.ts               # Zod-схемы для User
│
└── errors/
    └── AppError.ts           # Кастомные классы ошибок
```

### Разделение app.ts и server.ts

Это не случайное решение — это паттерн для тестируемости:

```ts
// app.ts — создаёт и конфигурирует Express app
// НЕ вызывает listen() — это делает server.ts
import express from 'express'
import cors from 'cors'
import { errorHandler } from './middleware/errorHandler.js'
import usersRouter from './routes/users.js'
import healthRouter from './routes/health.js'

const app = express()

// Middleware
app.use(cors())
app.use(express.json({ limit: '1mb' }))

// Routes
app.use('/health', healthRouter)
app.use('/api/users', usersRouter)

// 404 handler
app.use((req, res, next) => {
  next(new NotFoundError('Route', req.originalUrl))
})

// Error handler — ПОСЛЕДНИМ
app.use(errorHandler)

export default app
```

```ts
// server.ts — entry point
import { config } from './config.js'
import app from './app.js'

const server = app.listen(config.port, () => {
  console.log(`🚀 Server running on http://localhost:${config.port}`)
  console.log(`   Environment: ${config.nodeEnv}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})
```

**Зачем разделять?** Для тестов. `supertest` работает с `app`, не с `server`:

```ts
// users.test.ts
import request from 'supertest'
import app from '../app.js'

describe('GET /api/users', () => {
  it('returns users list', async () => {
    const res = await request(app).get('/api/users')
    expect(res.status).toBe(200)
    expect(res.body).toBeInstanceOf(Array)
  })
})
```

Если `app.ts` вызывает `listen()` — тест запустит реальный сервер на порту. С разделением — `supertest` использует `app` как handler без реального сервера.

### 🎯 На собесе

**Q: Как структурировать Express-приложение?**

✅ «Разделяю `server.ts` (entry point + listen + shutdown) и `app.ts` (middleware + routes) — это нужно для тестируемости, supertest работает с app без запуска сервера. Routes в отдельных файлах через Express Router. Middleware в отдельной папке. Схемы валидации — в schemas/. Ошибки — в errors/ с кастомными классами. На 10+ модулей перехожу на NestJS, который навязывает эту структуру.»

---

## 8. 🎯 Шпаргалка для собеседования

| Вопрос | Ключ к ответу |
|---|---|
| Что такое Express? | Тонкая обёртка над `http.createServer()`. Middleware pipeline + routing + расширенные req/res |
| Что возвращает `express()`? | Функция `(req, res) => void`, совместимая с `createServer()` |
| `res.json()` vs `res.send()`? | `json()` — явно JSON, корректно обрабатывает null/undefined. `send()` — универсальный |
| Что такое middleware? | Функция `(req, res, next)`. Либо отвечает, либо вызывает `next()` |
| Порядок middleware важен? | Да. `cors` → `json` → routes → error handler. Нарушение = молчаливый баг |
| `app.use()` vs `app.get()`? | `use` — любой метод, prefix matching. `get` — только GET, exact matching |
| Error handling middleware? | 4 аргумента: `(err, req, res, next)`. Express определяет по `function.length` |
| Async ошибки в Express 4? | Не ловятся! Нужен try/catch + `next(err)` или `asyncHandler` обёртка |
| Что такое Router? | Мини-приложение: middleware + routes. Монтируется через `app.use(prefix, router)` |
| `mergeParams`? | Объединяет параметры родителя и ребёнка при вложенных роутерах |
| Зачем zod? | Рантайм-валидация + TypeScript-типы из одной схемы. `z.infer<typeof schema>` |
| `z.coerce`? | Конвертирует строку в число/boolean перед валидацией. Нужен для query params |
| Зачем dotenv? | Загрузить `.env` в `process.env`. На проде переменные задаёт платформа |
| Fail fast? | Валидировать env при старте. Нет `DATABASE_URL` → `process.exit(1)` сразу |
| Зачем разделять app.ts и server.ts? | Для тестов: supertest работает с app без запуска сервера |
| Что такое `express.json()`? | Встроенный middleware для парсинга JSON body. Лимит 100 КБ по умолчанию |
| `helmet` — зачем? | Security headers: CSP, HSTS, X-Frame-Options. Одна строка кода |

---

## 9. ✅ Чек-поинт

«Понял, когда...»

- [ ] Можешь объяснить, что делает `express()` под капотом и как связан с `http.createServer`
- [ ] Знаешь разницу `app.use()` vs `app.get()` — prefix vs exact matching
- [ ] Понимаешь, почему порядок middleware критичен, и знаешь каноничный порядок
- [ ] Умеешь писать error handler с 4 аргументами и знаешь зачем все 4 обязательны
- [ ] Понимаешь проблему async ошибок в Express 4 и знаешь решение (`asyncHandler`)
- [ ] Написал zod-схему с `.safeParse()` и middleware `validate()`
- [ ] Знаешь `z.coerce.number()` для query params и `.partial()` для update-схем
- [ ] Валидируешь env при старте через zod — приложение падает сразу если нет нужных переменных
- [ ] Разделяешь `app.ts` и `server.ts` и понимаешь зачем (тестируемость)
- [ ] Умеешь структурировать Express-проект: routes/, middleware/, schemas/, errors/

---

## 10. Практика

### 🔴 Задание 1: Переписать Week 2 сервер на Express

Возьми свой `server.ts` из Week 2 и перепиши на Express:

1. Создай `src/week3/` с правильной структурой (app.ts, server.ts, config.ts, routes/, middleware/, schemas/, errors/)
2. Установи `express`, `@types/express`, `cors`, `@types/cors`, `dotenv`, `zod`
3. Перенеси CRUD эндпоинты `/users` в `routes/users.ts` через Express Router
4. Добавь `/health` эндпоинт в `routes/health.ts`
5. Middleware: `cors()`, `express.json()`, свой `loggerMiddleware` (замерить время ответа через `res.on('finish')`)

**Deliverable:** сервер на Express с тем же API, что и Week 2.

### 🔴 Задание 2: Zod-валидация

1. Создай `schemas/user.ts`: `createUserSchema`, `updateUserSchema` (через `.partial()`)
2. Создай `middleware/validate.ts`: middleware-фабрика для валидации body
3. Добавь валидацию на POST `/users` и PUT `/users/:id`
4. Ответ при ошибке: `{ error: 'Validation failed', details: [{ field, message }] }`

**Deliverable:** невалидный запрос возвращает 400 с детальным описанием ошибок.

### 🔴 Задание 3: Error Handler

1. Создай `errors/AppError.ts` с классами `NotFoundError`, `ValidationError`
2. Создай `middleware/errorHandler.ts` — централизованный error handler
3. Добавь 404 middleware после всех роутов
4. В обработчиках используй `throw new NotFoundError('User', id)` вместо `res.writeHead(404)`

**Deliverable:** все ошибки имеют единый формат `{ error, statusCode }`.

### 🟡 Задание 4: Environment config

1. Создай `.env` и `.env.example`
2. Создай `config.ts` с zod-валидацией env (PORT, NODE_ENV, JWT_SECRET)
3. Убедись что приложение падает при старте без `JWT_SECRET`
4. Добавь `.env` в `.gitignore`

### 🟢 Задание 5: Установка PostgreSQL

Подготовка к месяцу 2:

1. Установи PostgreSQL локально (`brew install postgresql@16` на macOS)
2. Создай базу `omnia_dev`: `createdb omnia_dev`
3. Подключись через `psql omnia_dev` — убедись что работает
4. Добавь `DATABASE_URL=postgres://localhost:5432/omnia_dev` в `.env`

