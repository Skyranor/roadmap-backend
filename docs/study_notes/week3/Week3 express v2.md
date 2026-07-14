# Неделя 3 · Express — структура, middleware, request lifecycle

> Обновлено: июль 2026. Актуализировано под Express 5 (дефолт npm с марта 2025, дефолт NestJS 11 с января 2025). Версия 2: исправлена ошибка в версии Express, реструктурирован Middleware, добавлены Request Lifecycle, Debugging, Production Checklist.

---

## Содержание

0. [Зачем мы изучаем Express](#0-зачем-мы-изучаем-express)
1. [Express: что это и как работает под капотом](#1-express-что-это-и-как-работает-под-капотом)
2. [Middleware: цепочка, next() и порядок](#2-middleware-цепочка-next-и-порядок)
   - 2.1 [Error Middleware](#21-error-middleware)
   - 2.2 [Built-in Middleware](#22-built-in-middleware)
   - 2.3 [Third-party Middleware](#23-third-party-middleware)
3. [Request Lifecycle](#3-request-lifecycle)
4. [Routing: Router, параметры, вложенные роуты](#4-routing-router-параметры-вложенные-роуты)
5. [Error Handling Middleware — глубокое погружение](#5-error-handling-middleware--глубокое-погружение)
6. [Валидация с zod](#6-валидация-с-zod)
7. [Конфигурация: env → config → application](#7-конфигурация-env--config--application)
8. [Express 4 vs Express 5](#8-express-4-vs-express-5)
9. [Структура Express-проекта](#9-структура-express-проекта)
10. [Debugging](#10-debugging)
11. [Production Checklist](#11-production-checklist)
12. [🎯 Шпаргалка для собеседования](#12-шпаргалка-для-собеседования)
13. [✅ Чек-поинт](#13-чек-поинт)
14. [Практика](#14-практика)

---

## 0. Зачем мы изучаем Express

Мы изучаем Express **не потому, что будем писать на нём Omnia в продакшене**. Omnia в итоге поедет на NestJS.

Мы изучаем Express, потому что NestJS построен поверх тех же концепций:

```
Express                        NestJS
────────                       ──────
middleware chain          →    middleware / interceptors / guards / pipes
Router                    →    Controller + декораторы маршрутов
req/res lifecycle         →    execution context
error middleware          →    exception filters
```

DI (dependency injection), модули, декораторы — появятся позже и являются главным отличием NestJS. Но request lifecycle, на котором всё это строится, — тот же самый, что ты видишь сейчас в голом Express. Если сейчас понимаешь, почему `express.json()` должен стоять раньше роутов, — через месяц ты так же интуитивно поймёшь, почему `ValidationPipe` в Nest применяется до контроллера, а не после.

Второй практический повод: production-код на Express 4 всё ещё массово встречается — большая часть существующих продакшн-флотов Express в 2026 году работает на ветке 4.17.x–4.22.x, и ты будешь на неё натыкаться при найме на support/legacy-задачи. Поэтому в этой неделе везде, где поведение Express 4 и 5 расходится, оба варианта разобраны явно — не как исторический экскурс, а как то, что реально встретится.

---

## 1. Express: что это и как работает под капотом

### TL;DR

Express — тонкая обёртка над `node:http`. Даёт три вещи: **middleware pipeline**, **routing** и удобный API (`req.params`, `req.body`, `res.json`). Внутри — тот же `http.createServer`, но с правильной абстракцией. Ты уже написал обе части руками в Week 2 — здесь увидишь, как Express делает то же самое, но продуманнее.

### ⏭ Что пропустить

Ты написал `Router` с regex-паттернами и `createApp()` с цепочкой middleware. Не нужно заново учить:

- Что такое `req` и `res` — ты уже работаешь с `IncomingMessage` и `ServerResponse`
- Middleware как концепт — ты реализовал `loggerMiddleware`, `jsonParserMiddleware`, `corsMiddleware`
- Как работает `next()` — ты написал `handle()` с замыканием на `index`

Фокус — чем Express отличается от твоей реализации.

### Что такое Express — точное определение

> **📦 Deep Dive** — это уровень "интересно понимать откуда растут ноги", не обязательный для работы. Можно пропустить при первом проходе и вернуться позже.
>
> Express построен на двух библиотеках:
>
> | Зависимость          | Что делает                                              | Твой аналог из Week 2              |
> | -------------------- | ------------------------------------------------------- | ---------------------------------- |
> | **`path-to-regexp`** | Конвертирует `/users/:id` в RegExp                      | Метод `addRoute()` в `router.ts`   |
> | **`finalhandler`**   | Обрабатывает ошибки, если ни один middleware не ответил | Проверка `if (!middleware) return` |
>
> Express сам по себе **не добавляет** body parsing, CORS, авторизацию — всё это отдельные middleware-пакеты. Express = ядро pipeline + routing.

### Как Express работает внутри

```
┌──────────────────────────────────────────────────────────────┐
│                     express()                                │
│                                                                │
│  1. Создаёт объект app (он же — функция!)                    │
│  2. app хранит массив middleware (app._router.stack)         │
│  3. app(req, res) === app.handle(req, res)                   │
│                                                                │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ http.createServer(app)                                │   │
│  │                                                        │   │
│  │ На каждый запрос Node.js вызывает app(req, res)       │   │
│  │ → Express расширяет req и res прототипами             │   │
│  │ → запускает цепочку middleware из stack               │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Ключевой инсайт:** `app` — это **функция** `(req, res, next) => void`, которая передаётся в `http.createServer()`. Точно как твоя `app.handle` — но Express делает `app` вызываемым напрямую.

### 🔗 Твой код vs Express

Твой Week 2 сервер:

```ts
const app = createApp()
app.use(corsMiddleware)
app.use(loggerMiddleware)
app.use(jsonParserMiddleware)
app.use((req, res) => { ... })

const server = createServer((req, res) => {
  app.handle(req as RouteRequest, res)
})
```

Express-эквивалент:

```ts
import express from 'express'

const app = express()
app.use(cors())
app.use(express.json())
app.get('/users', (req, res) => {
	res.json(users)
})

app.listen(3000)
```

### Что Express добавляет к req и res

#### req — расширения

| Свойство/метод    | Что делает                  | Твой аналог                       |
| ----------------- | --------------------------- | --------------------------------- |
| `req.params`      | Параметры из URL            | Добавлял вручную                  |
| `req.query`       | Query string                | Парсил `url.split('?')`           |
| `req.body`        | Распарсенный body           | Добавлял в `jsonParserMiddleware` |
| `req.path`        | Путь без query string       | `url.split('?')[0]`               |
| `req.get(header)` | Заголовок, case-insensitive | `req.headers['content-type']`     |
| `req.ip`          | IP клиента (с учётом proxy) | `req.socket.remoteAddress`        |

> ⚠ В Express 5 `req.query` — **read-only геттер**, не свойство. Прямое присваивание `req.query = {...}` больше не сработает (в Express 4 работало). Если нужно модифицировать распарсенные query-параметры (например, после кастомной санитайзинг-логики) — пиши в отдельное поле, например `req.parsedQuery`, а не перезаписывай `req.query`.

#### res — расширения

| Метод                  | Что делает                         | Твой аналог                    |
| ---------------------- | ---------------------------------- | ------------------------------ |
| `res.json(data)`       | `setHeader + JSON.stringify + end` | Писал руками каждый раз        |
| `res.status(code)`     | Ставит статус, возвращает `res`    | `res.writeHead(code, headers)` |
| `res.send(data)`       | Универсальный отправщик            | Нет аналога                    |
| `res.redirect(url)`    | 302 редирект                       | Нет аналога                    |
| `res.set(header, val)` | Заголовок                          | `res.setHeader(header, val)`   |

> В Express 5 `res.status(code)` валидирует, что `code` — целое число 100–999, и бросает ошибку на некорректном значении (в Express 4 просто пропускал что угодно). Небольшая, но полезная деталь: баг "забыл преобразовать статус в число" теперь падает сразу, а не тихо ломает ответ.

### res.json() vs res.send()

```ts
// res.json() корректно обрабатывает:
res.json(null) // → "null"
res.json(undefined) // → "null"
res.json(0) // → "0"
res.json(false) // → "false"

// res.send() с этими значениями ведёт себя иначе:
res.send(null) // → '' (пустое тело, status 200)
res.send(undefined) // → '' (пустое тело)
```

**Правило:** для API всегда `res.json()`. `res.send()` — для HTML/plain text.

### Установка

```bash
npm install express
npm install -D @types/express
```

> ⚠ `npm install express` сегодня ставит **Express 5** (см. [раздел 8](#8-express-4-vs-express-5)). `@types/express` — типы, а не рантайм-зависимость, в `devDependencies`.

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

### app.listen() — что внутри

```ts
// Псевдокод внутри Express:
app.listen = function (port, callback) {
	const server = http.createServer(this)
	return server.listen(port, callback)
}
```

`app.listen()` возвращает `http.Server` — сохрани его для graceful shutdown:

```ts
const server = app.listen(3000)

process.on('SIGTERM', () => {
	server.close(() => {
		console.log('Shutdown complete')
		process.exit(0)
	})
})
```

### 🎯 На собесе

**Q: Чем Express отличается от чистого http.createServer?**

✅ «Express — тонкая обёртка над `http.createServer()`. Добавляет middleware pipeline, routing через `path-to-regexp` и расширенные `req`/`res`. Внутри `app` — функция `(req, res) => void`, передаётся в `createServer`. Express не добавляет body parsing, cors, auth — это отдельные middleware.»

**Q: Что возвращает `express()`?**

✅ «Функцию `app`, совместимую с `http.createServer(app)`. Одновременно объект с методами `.get()`, `.use()`, `.listen()`. На запрос Node.js вызывает `app(req, res)`, Express расширяет req/res через прототип и запускает middleware stack.»

---

## 2. Middleware: цепочка, next() и порядок

### Суть в 5 предложениях

Middleware — функция `(req, res, next) => void`. Каждый middleware решает: ответить (тогда `next()` не вызывается) или передать дальше (`next()`). Порядок `app.use()` — порядок выполнения, он критичен. Express формально выделяет 5 типов middleware (application-level, router-level, error-handling, built-in, third-party), но под капотом это всё функции с одинаковой сигнатурой — кроме error-handling, у которой сигнатура другая (см. [2.1](#21-error-middleware)).

### 🔗 Твоя реализация vs Express

```ts
// middleware.ts — твоя реализация Week 2
function handle(req, res) {
	let index = 0
	function next(err?: Error): void {
		if (err) {
			res.statusCode = 500
			res.end(JSON.stringify({ error: err.message }))
			return
		}
		const middleware = middlewares[index++]
		if (!middleware) return
		try {
			middleware(req, res, next)
		} catch (e) {
			next(e as Error)
		}
	}
	next()
}
```

Express делает то же самое плюс три дополнения:

1. **Path matching** — middleware можно привязать к конкретному пути (`app.use('/api', ...)`), не только глобально
2. **Router layer** — middleware организуются в слои (`Layer`) с паттерном пути и ссылкой на функцию
3. **Error middleware** — отдельная сигнатура с 4 аргументами

### Порядок выполнения

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

| Правило                      | Почему                                              |
| ---------------------------- | --------------------------------------------------- |
| `cors()` — первый            | Preflight (OPTIONS) должен ответить до body parsing |
| `express.json()` — до роутов | Иначе `req.body` будет `undefined` в обработчиках   |
| Роуты — в середине           | Обрабатывают запросы                                |
| Error handler — последний    | Ловит ошибки из всех предыдущих middleware          |

> **На проде это ломается так:** `express.json()` после роутов → все POST приходят с `req.body === undefined`. Баг молчаливый — нет ошибки, просто пустое тело. Отладка — часы, потому что логи не показывают проблему.

### app.use() vs app.get() / app.post()

```ts
// app.use() — ЛЮБОЙ метод, matching по ПРЕФИКСУ
app.use('/api', (req, res, next) => {
	// GET /api/..., POST /api/..., DELETE /api/... — всё сматчится
	next()
})

// app.get() — ТОЛЬКО GET, ТОЧНОЕ совпадение
app.get('/api/users', (req, res) => {
	// НЕ вызывается для GET /api/users/123
	res.json(users)
})
```

|               | `app.use(path, fn)`   | `app.get(path, fn)` |
| ------------- | --------------------- | ------------------- |
| HTTP метод    | Любой                 | Только GET          |
| Path matching | Префикс               | Точный              |
| Назначение    | Cross-cutting concern | Route handler       |

```ts
app.use('/api', (req, res, next) => {
	// Запрос: GET /api/users/42
	console.log(req.url) // '/users/42' — Express отрезал '/api'
	console.log(req.baseUrl) // '/api'
	console.log(req.originalUrl) // '/api/users/42'
	next()
})
```

### Application-level и Router-level middleware

```ts
// Application-level — для всех маршрутов
app.use((req, res, next) => {
	console.log(`${req.method} ${req.url}`)
	next()
})

// Application-level — для конкретного пути (префикс!)
app.use('/admin', (req, res, next) => {
	if (!req.user?.isAdmin) return res.status(403).json({ error: 'Forbidden' })
	next()
})

// Router-level — ограниченная область видимости
const router = express.Router()
router.use((req, res, next) => {
	console.log('Router-level middleware')
	next()
})
router.get('/users', handler)
app.use('/api', router)
```

### next() — три способа вызова

```ts
app.use((req, res, next) => {
	next() // 1. Следующему middleware
	next(new Error('Something broke')) // 2. В error handler
	next('route') // 3. Пропустить оставшиеся callbacks ЭТОГО route
})
```

```ts
app.get(
	'/users/:id',
	(req, res, next) => {
		if (req.params.id === '0') return next('route')
		next()
	},
	(req, res) => {
		res.json({ id: req.params.id })
	},
)

app.get('/users/:id', (req, res) => {
	res.json({ id: '0', name: 'System User' })
})
```

### Подводный камень: async middleware

> **Разное поведение в Express 4 и 5 — см. таблицу в [разделе 8](#8-express-4-vs-express-5) для полной картины.**

```ts
// Express 4: ⛔ ОПАСНО — не поймает ошибку!
app.get('/users', async (req, res) => {
	const users = await db.getUsers() // Если упадёт — unhandled rejection
	res.json(users)
})

// Express 5: ✅ автоматически перехватывается и уходит в error handler
app.get('/users', async (req, res) => {
	const users = await db.getUsers() // Rejected promise → next(err) вызывается сам
	res.json(users)
})
```

Если ты сегодня делаешь `npm install express` — ты получаешь Express 5, и этот код безопасен по умолчанию. Но:

1. **На собесе спрашивают про Express 4** — не потому что это устарело, а потому что это реальный опыт большинства действующих кодовых баз. Знай оба поведения.
2. **Явный try/catch всё равно полезен**, когда нужно вернуть конкретный статус-код вместо дефолтного 500, или залогировать контекст до передачи в error handler.

```ts
// Явный контроль — уместен независимо от версии Express
app.get('/users', async (req, res, next) => {
	try {
		const users = await db.getUsers()
		res.json(users)
	} catch (err) {
		next(err)
	}
})
```

Обёртка, чтобы не дублировать try/catch (актуальна для Express 4 и как стилистический паттерн для Express 5):

```ts
function asyncHandler(
	fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
	return (req: Request, res: Response, next: NextFunction) => {
		fn(req, res, next).catch(next)
	}
}

app.get(
	'/users',
	asyncHandler(async (req, res) => {
		const users = await db.getUsers()
		res.json(users)
	}),
)
```

### 🎯 На собесе

**Q: Что такое middleware в Express?**

✅ «Функция `(req, res, next)`. Express организует их в стек: либо отвечает клиенту (без `next()`), либо передаёт управление дальше (`next()`). Порядок `app.use()` = порядок выполнения. Error-handling middleware — 4 аргумента, определяется по `function.length`.»

**Q: Почему порядок middleware важен?**

✅ «Middleware выполняются строго последовательно. `express.json()` после роутов → `req.body` undefined. CORS после auth guard → preflight OPTIONS вернёт 401. Error handler — последний, ловит ошибки из всех предыдущих.»

**Q: Как Express обрабатывает async ошибки?**

✅ «В Express 4 — не ловит rejected promises автоматически, нужен try/catch + `next(err)` или `asyncHandler`. В Express 5 (дефолт с 2025 года) rejected promises из async-хендлеров перехватываются автоматически и уходят в error middleware.»

---

### 2.1 Error Middleware

Единственный тип middleware, где Express отличается принципиально: **4 аргумента** вместо 3 — `(err, req, res, next)`. Express определяет тип по `function.length`.

```ts
// Обычный middleware — 3 аргумента
app.use((req, res, next) => { ... })

// Error middleware — 4 аргумента, ВСЕ ОБЯЗАТЕЛЬНЫ
app.use((err, req, res, next) => { ... })
```

> **📦 Deep Dive** — `function.length` — это количество формально объявленных параметров функции (не считая тех, что после rest/default в некоторых случаях). Express буквально читает эту цифру, чтобы решить, error-handler это или нет. Если убрать `next` из сигнатуры (даже неиспользуемый) — Express перестанет считать функцию error-хендлером, и ошибки будут пролетать мимо. Полное погружение — в [разделе 5](#5-error-handling-middleware--глубокое-погружение).

Базовый пример:

```ts
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error(err.stack)
	res.status(500).json({ error: 'Internal Server Error' })
})
```

Ставится **последним** в цепочке — иначе не ловит ошибки из middleware, зарегистрированных после него.

---

### 2.2 Built-in Middleware

Express 4.x/5.x имеет три встроенных middleware:

```ts
app.use(express.json()) // JSON body parser
app.use(express.urlencoded({ extended: true })) // HTML-формы
app.use(express.static('public')) // Статические файлы
```

`express.json()` vs твой `jsonParserMiddleware`:

|                    | Твоя реализация                             | `express.json()`                            |
| ------------------ | ------------------------------------------- | ------------------------------------------- |
| Content-Type check | `contentType?.includes('application/json')` | То же + charset                             |
| Size limit         | `MAX_BODY_SIZE = 1024 * 1024`               | `{ limit: '100kb' }` по умолчанию           |
| Encoding           | Только UTF-8                                | По `Content-Type` charset                   |
| Strict mode        | Нет                                         | `{ strict: true }` — только объекты/массивы |

> **Почему body parser вообще может стать вектором DoS.** Body parser читает тело запроса в память **до** того, как твой код увидит хотя бы один байт. Без лимита клиент может прислать тело на несколько гигабайт — сервер попытается забуферизовать всё это в памяти одного process'а, что кладёт event loop и может уронить инстанс без единой "настоящей" бизнес-операции. Именно поэтому `express.json()` **по умолчанию ограничивает тело 100 КБ** — это не случайное число, это защита из коробки.
>
> На проде лимит почти всегда нужно поднять под реальные payload'ы (например, `express.json({ limit: '1mb' })`), но:
>
> - никогда не ставь лимит "с запасом на всякий случай" (10mb "чтобы не думать") — это отключает защиту, которую фреймворк дал бесплатно
> - для действительно больших payload'ов (аплоад файлов) используй **streaming** (multipart upload, `multer`, presigned URLs — см. отдельную неделю File Uploads), а не поднятие лимита JSON body parser'а
> - rate limiting (`express-rate-limit`) и лимит body — это две разные линии защиты, они не заменяют друг друга: лимит защищает от одного огромного запроса, rate limit — от множества маленьких

```ts
app.use(express.json({ limit: '1mb' }))
```

`express.urlencoded({ extended: true })`:

```ts
app.use(express.urlencoded({ extended: true }))

app.post('/login', (req, res) => {
	// req.body = { name: 'Dzmitry', email: 'dzmitry@omnia.dev' }
})
```

`extended: true` использует `qs` — поддерживает вложенные объекты (`user[name]=Dzmitry`). `extended: false` — `querystring`, только плоские значения. Для JSON API обычно не нужен вовсе; нужен, если сервер принимает HTML-формы напрямую.

> ⚠ `express.static` в Express 5 по умолчанию **не** отдаёт dot-файлы/директории (`dotfiles: 'ignore'` теперь дефолт, в Express 4 отдавались). Если тебе нужно раздавать что-то вроде `.well-known` (например, для доменной верификации) — указывай явно: `app.use('/.well-known', express.static('public/.well-known', { dotfiles: 'allow' }))`.

---

### 2.3 Third-party Middleware

Устанавливаются через npm. Частые на проде и на собесах:

| Пакет                | Что делает                              | Когда ставить                       |
| -------------------- | --------------------------------------- | ----------------------------------- |
| `cors`               | CORS-заголовки                          | Всегда для API                      |
| `helmet`             | Security-заголовки (CSP, HSTS, X-Frame) | Всегда на проде                     |
| `morgan`             | HTTP-логирование                        | Dev + Prod                          |
| `compression`        | gzip/brotli                             | Prod (если нет Nginx перед Express) |
| `cookie-parser`      | Парсит cookies в `req.cookies`          | Когда нужны cookies                 |
| `express-rate-limit` | Rate limiting                           | Auth endpoints                      |

```ts
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

app.use(helmet()) // Security headers — ПЕРВЫМ
app.use(cors({ origin: 'https://omnia.dev' })) // CORS
app.use(morgan('combined')) // Логирование
app.use(express.json()) // Body parsing
```

---

## 3. Request Lifecycle

Собери воедино всё из раздела 2: вот полный путь запроса через типичный production Express-сервер. Это та же самая схема, которую ты увидишь в NestJS через несколько месяцев — просто там каждый шаг оформлен декоратором вместо ручного `app.use()`.

```
Incoming Request
      │
      ▼
   Logger              (morgan / pino — время начала, method, url)
      │
      ▼
   Helmet              (security headers)
      │
      ▼
   CORS                (preflight OPTIONS отвечает здесь же)
      │
      ▼
   Body Parser          (express.json / express.urlencoded — лимит!)
      │
      ▼
   Authentication        (кто ты — верификация JWT/сессии)
      │
      ▼
   Authorization       (что тебе можно — роли, права)
      │
      ▼
   Validation          (zod — форма данных корректна?)
      │
      ▼
   Router / Controller  (какой обработчик отвечает за этот путь)
      │
      ▼
   Business Logic       (твой код)
      │
      ▼
   Database             (запрос к PostgreSQL)
      │
      ▼
   Serialization         (что именно вернуть клиенту — res.json)
      │
      ▼
    Response
```

Если на любом шаге происходит `throw` или `next(err)` — поток уходит в сторону, минуя всё, что ниже, и падает в error middleware (см. [раздел 5](#5-error-handling-middleware--глубокое-погружение)).

> **Мэппинг на NestJS (забегая вперёд, для контекста):**
>
> | Express                       | NestJS                                      |
> | ----------------------------- | ------------------------------------------- |
> | Logger/Helmet/CORS middleware | Global middleware (`app.use()` в `main.ts`) |
> | Authentication middleware     | Guard (`@UseGuards(AuthGuard)`)             |
> | Authorization middleware      | Guard / decorator (`@Roles('admin')`)       |
> | Validation middleware (zod)   | Pipe (`ValidationPipe`)                     |
> | Router handler                | Controller method (`@Get()`)                |
> | Error middleware              | Exception filter (`@Catch()`)               |
>
> Не нужно запоминать это сейчас — просто держи в голове, что порядок концептуально не меняется, меняется только то, как эти шаги оформлены синтаксически.

---

## 4. Routing: Router, параметры, вложенные роуты

### Суть

Express Router — «мини-приложение», умеющее только routing и middleware. Монтируется через `app.use(path, router)`. Позволяет разбить приложение на модули: `/users` — один файл, `/workspaces` — другой.

### 🔗 Твой Router vs Express Router

```ts
// router.ts — Week 2
const router = new Router()
router.get('/users', handler)
router.get('/users/:id', handler)

app.use((req, res) => {
	const result = router.match(method, url)
	if (!result) {
		res.writeHead(404)
		res.end()
		return
	}
	req.params = result.params
	result.handler(req, res)
})
```

```ts
// Express Router
import { Router } from 'express'

const router = Router()
router.get('/users', handler)
router.get('/users/:id', handler)

app.use('/api', router) // match + params — сам
```

### Создание Router

```ts
// src/routes/users.ts
import { Router } from 'express'

const router = Router()

router.use((req, res, next) => {
	console.log(`Users router: ${req.method} ${req.url}`)
	next()
})

router.get('/', (req, res) => {
	res.json(users)
})

router.get('/:id', (req, res) => {
	const user = users.find(u => u.id === req.params.id)
	if (!user) return res.status(404).json({ error: 'Not found' })
	res.json(user)
})

router.post('/', (req, res) => {
	const { name, email } = req.body
	res.status(201).json(newUser)
})

export default router
```

```ts
// src/app.ts
import express from 'express'
import usersRouter from './routes/users.js'

const app = express()
app.use(express.json())
app.use('/api/users', usersRouter)

export default app
```

### Параметры маршрута

```ts
router.get('/users/:id', handler)
// GET /users/42 → req.params = { id: '42' }

router.get('/workspaces/:workspaceId/members/:memberId', handler)
// GET /workspaces/abc/members/123
// → req.params = { workspaceId: 'abc', memberId: '123' }
```

> **`req.params` всегда содержит строки.** Даже если ID — число, `req.params.id` будет `'42'`. Парсить и валидировать через `z.coerce.number()` или `parseInt`.

### ⚠ Опциональные параметры — синтаксис поменялся в Express 5

```ts
// ❌ Express 4 — синтаксис, который упадёт на Express 5
router.get('/users/:id/posts/:postId?', handler)
```

Начиная с Express 5 (path-to-regexp 8.x), суффикс `?` для опциональных параметров **не поддерживается** — вместо него используются фигурные скобки вокруг всего опционального сегмента:

```ts
// ✅ Express 5
router.get('/users/:id/posts{/:postId}', handler)
```

```
GET /users/42/posts      → req.params = { id: '42' }              (postId ОТСУТСТВУЕТ в объекте)
GET /users/42/posts/7    → req.params = { id: '42', postId: '7' }
```

> Обрати внимание: в Express 4 непереданный опциональный параметр попадал в `req.params` со значением `undefined` (ключ был, значение — нет). В Express 5 ключ **полностью отсутствует** в объекте. Если где-то в коде стоит проверка вида `if ('postId' in req.params)` — поведение изменится. Проверяй через `req.params.postId !== undefined` или, надёжнее, через `'postId' in req.params === false`, и протестируй на конкретной версии, которая стоит в `package.json`.

Та же логика для wildcard-роутов (если понадобятся, например для catch-all/404):

```ts
// ❌ Express 4
app.all('*', notFoundHandler)

// ✅ Express 5 — wildcard обязан иметь имя
app.all('/*splat', notFoundHandler) // не матчит корень '/'
app.all('/{*splat}', notFoundHandler) // матчит и корень тоже
```

### Query string

```ts
// GET /users?page=2&limit=10&sort=name
router.get('/users', (req, res) => {
	console.log(req.query)
	// { page: '2', limit: '10', sort: 'name' } — всё строки

	const page = parseInt(req.query.page as string, 10) || 1
	const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100)
})
```

> ⚠ Начиная с Express 5, дефолтный query-парсер — `"simple"` (нативный `querystring`), а не `"extended"` (`qs`), как было в Express 4. `"simple"` **не** понимает вложенные ключи вида `?filter[status]=active` — такой запрос вернёт `req.query` с буквальным ключом `"filter[status]"`, а не вложенным объектом `{ filter: { status: 'active' } }`. Если Omnia использует вложенные query-параметры (например, фильтры в списочных эндпоинтах) — включай `extended` явно:
>
> ```ts
> app.set('query parser', 'extended')
> ```
>
> Плюс: `req.query` в Express 5 — read-only геттер, напрямую его не перезаписать (см. [раздел 1](#1-express-что-это-и-как-работает-под-капотом)).

### router.param() — предобработка параметров

```ts
router.param('id', (req, res, next, id) => {
	const user = users.find(u => u.id === id)
	if (!user) return res.status(404).json({ error: 'User not found' })
	req.user = user
	next()
})

router.get('/:id', (req, res) => {
	res.json(req.user)
})

router.put('/:id', (req, res) => {
	Object.assign(req.user, req.body)
	res.json(req.user)
})
```

Убирает дублирование `users.find()` + `if (!user)` из каждого обработчика.

### Вложенные роутеры

```ts
// routes/members.ts
const membersRouter = Router({ mergeParams: true })
// ↑ mergeParams: true — чтобы :workspaceId был доступен внутри membersRouter

membersRouter.get('/', (req, res) => {
	const { workspaceId } = req.params
	res.json(getMembersByWorkspace(workspaceId))
})

// routes/workspaces.ts
workspacesRouter.use('/:workspaceId/members', membersRouter)

// app.ts
app.use('/api/workspaces', workspacesRouter)
```

```
GET  /api/workspaces/:workspaceId/members
POST /api/workspaces/:workspaceId/members
GET  /api/workspaces/:workspaceId/members/:id
```

> `mergeParams: true` — без него `req.params.workspaceId` будет `undefined` внутри `membersRouter`, потому что по умолчанию каждый роутер имеет свою область видимости параметров.

### Route chaining — app.route()

```ts
router.route('/users').get(getUsers).post(createUser)

router.route('/users/:id').get(getUser).put(updateUser).delete(deleteUser)
```

Стилистически чище, поведение идентичное.

### 🎯 На собесе

**Q: Что такое Router в Express?**

✅ «Изолированный экземпляр middleware и routes — "мини-приложение", которое не умеет `listen`, но умеет остальное. Монтируется через `app.use(prefix, router)`. Разбивает API на модули, каждый не знает свой финальный prefix.»

**Q: Что изменилось в роутинге между Express 4 и 5?**

✅ «path-to-regexp обновлён с 0.1.x до 8.x. Опциональные параметры теперь через фигурные скобки вместо `?`. Wildcard обязан иметь имя (`/*splat` вместо `*`). Inline-регулярки в путях убраны из соображений ReDoS. Непереданные опциональные параметры теперь полностью отсутствуют в `req.params`, а не присутствуют как `undefined`.»

**Q: Что такое `mergeParams`?**

✅ «По умолчанию каждый Router имеет свою область параметров. `mergeParams: true` при создании дочернего роутера объединяет параметры родителя и ребёнка в один `req.params`.»

---

## 5. Error Handling Middleware — глубокое погружение

### Суть

Обычный middleware — 3 аргумента. Error middleware — **4**: `(err, req, res, next)`. Express определяет тип по `function.length`.

> **Критично:** error handler с 3 аргументами (забыл `next`) Express посчитает обычным middleware. Ошибки пролетят мимо. Баг молчаливый.

### Как ошибки попадают в error handler

```
1. Явный вызов next(err)
   app.get('/users', (req, res, next) => {
     next(new Error('DB connection failed'))
   })

2. Синхронный throw
   app.get('/users', (req, res) => {
     throw new Error('Unexpected') // Express поймает
   })

3. Express 5: async throw тоже ловится автоматически
   app.get('/users', async (req, res) => {
     throw new Error('Unexpected') // Rejected promise → error handler сам
   })

   ⚠ В Express 4 пункт 3 НЕ работает — нужен try/catch + next(err) или asyncHandler
```

### Production-ready error handler

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
		Object.setPrototypeOf(this, new.target.prototype)
		Error.captureStackTrace(this, this.constructor)
	}
}

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

**Зачем `isOperational`?**

| Тип                                    | Пример                    | Что делать                                         |
| -------------------------------------- | ------------------------- | -------------------------------------------------- |
| **Operational** (`true`)               | 404, 400, 401, rate limit | Ожидаемая ошибка — понятный ответ клиенту          |
| **Programming** (`false`, не AppError) | TypeError, null reference | Баг — залогировать, 500, возможен рестарт процесса |

#### Шаг 2: Централизованный handler

```ts
// src/middleware/errorHandler.ts
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../errors/AppError.js'

export function errorHandler(
	err: Error,
	req: Request,
	res: Response,
	next: NextFunction, // все 4 аргумента обязательны
): void {
	if (err instanceof AppError) {
		res.status(err.statusCode).json({
			error: err.message,
			statusCode: err.statusCode,
		})
		return
	}

	console.error('💥 Unexpected error:', {
		message: err.message,
		stack: err.stack,
		url: req.originalUrl,
		method: req.method,
	})

	res.status(500).json({
		error:
			process.env.NODE_ENV === 'production'
				? 'Internal Server Error'
				: err.message,
		statusCode: 500,
	})
}
```

#### Шаг 3: Использование

```ts
// app.ts
app.use(express.json())
app.use('/api/users', usersRouter)

// 404 — ПОСЛЕ всех роутов
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
	if (!user) throw new NotFoundError('User', req.params.id)
	res.json(user)
})
```

### Когда НЕ нужен try/catch

Частый вопрос на собесе. Правило: try/catch нужен там, где ты хочешь **что-то сделать с ошибкой до того, как она уйдёт дальше** — залогировать с контекстом, обернуть в другой тип, вернуть частичный fallback. Если единственное действие — "передать ошибку в error handler", отдельный try/catch избыточен:

```ts
// Избыточно — asyncHandler уже сделает .catch(next)
app.get(
	'/users',
	asyncHandler(async (req, res) => {
		try {
			const users = await db.getUsers()
			res.json(users)
		} catch (err) {
			throw err // ничего не добавляет
		}
	}),
)

// Оправдано — есть что добавить к ошибке
app.get(
	'/users',
	asyncHandler(async (req, res) => {
		try {
			const users = await db.getUsers()
			res.json(users)
		} catch (err) {
			throw new AppError('Failed to fetch users', 503) // осмысленный статус вместо голого 500
		}
	}),
)
```

Цепочка на проде: `asyncHandler` (или Express 5 автоматика) → `global error middleware` → классификация через `AppError`. Три уровня, каждый со своей ответственностью — не дублировать логику между ними.

### Подводный камень: «Проглоченная» ошибка

```ts
// ⛔ 3 аргумента — Express считает это ОБЫЧНЫМ middleware!
app.use((err: Error, req: Request, res: Response) => {
	res.status(500).json({ error: err.message })
})

// ✅ Все 4 аргумента
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	res.status(500).json({ error: err.message })
})
```

Если `next` не используется — можно `_next` или eslint-disable, но **не удалять аргумент**.

### 🎯 На собесе

**Q: Напиши error handling middleware для Express.**

✅ Сигнатура `(err, req, res, next)`, 4 аргумента. Express определяет по `function.length === 4`. Operational-ошибки (`AppError`) — свой `statusCode`. Programming-ошибки — 500 + логирование. На проде — скрыть stack trace от клиента.

**Q: Что произойдёт при ошибке в async route handler без try/catch?**

✅ «В Express 4 — unhandled promise rejection, error handler не вызывается, сервер может зависнуть без ответа клиенту. В Express 5 — автоматически перехватывается и уходит в error middleware.»

---

## 6. Валидация с zod

### Зачем валидация на бэкенде

Фронтенд-валидация — UX. Бэкенд-валидация — безопасность. Клиент может прислать что угодно. **Никогда не доверяй входным данным.**

Твой Week 2 подход:

```ts
if (!body || typeof body.name !== 'string' || typeof body.email !== 'string') {
	res.writeHead(400)
	res.end(JSON.stringify({ error: 'name and email are required' }))
	return
}
```

Проблемы: многословно, нет типизации после проверки, нет деталей по полям, дублирование между эндпоинтами.

### Что такое zod

Библиотека schema validation для TypeScript. Схема = валидация + вывод типа.

```bash
npm install zod
```

```ts
import { z } from 'zod'

const createUserSchema = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters'),
	email: z.string().email('Invalid email format'),
})

type CreateUserDto = z.infer<typeof createUserSchema>
// → { name: string; email: string }
```

### Типы данных в zod

```ts
z.string()
z.number()
z.boolean()
z.date()

z.string().min(1)
z.string().max(255)
z.string().email()
z.string().url()
z.string().uuid()
z.string().regex(/^[a-z]+$/)
z.string().trim()

z.number().int()
z.number().positive()
z.number().min(1).max(100)

z.string().optional() // string | undefined
z.string().nullable() // string | null
z.string().default('guest')

z.literal('admin')
z.enum(['owner', 'admin', 'member'])

z.array(z.string())
z.array(z.string()).min(1)
z.array(z.string()).max(10)
```

### Объекты и вложенность

```ts
const createWorkspaceSchema = z.object({
	name: z.string().min(1, 'Name is required').max(100),
	slug: z
		.string()
		.min(3)
		.max(50)
		.regex(
			/^[a-z0-9-]+$/,
			'Slug must contain only lowercase letters, numbers and hyphens',
		),
	description: z.string().max(500).optional(),
	settings: z
		.object({
			isPublic: z.boolean().default(false),
			maxMembers: z.number().int().positive().default(50),
		})
		.optional(),
})
```

### Парсинг vs проверка

```ts
// .parse() — бросает ZodError
try {
	const user = createUserSchema.parse(req.body)
} catch (err) {
	if (err instanceof z.ZodError) {
		/* err.errors */
	}
}

// .safeParse() — не бросает, возвращает union
const result = createUserSchema.safeParse(req.body)
if (!result.success) {
	console.log(result.error.errors)
} else {
	const user = result.data
}
```

> **Правило:** в middleware — `.safeParse()`. `.parse()` — для скриптов и тестов.

### Validation middleware

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
		req.body = result.data
		next()
	}
}
```

```ts
router.post('/', validate(createUserSchema), (req, res) => {
	const { name, email } = req.body
})
```

### Валидация params и query

```ts
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
				errors.push(
					...result.error.errors.map(e => ({
						source: 'body',
						field: e.path.join('.'),
						message: e.message,
					})),
				)
			} else {
				req.body = result.data
			}
		}

		if (schemas.params) {
			const result = schemas.params.safeParse(req.params)
			if (!result.success) {
				errors.push(
					...result.error.errors.map(e => ({
						source: 'params',
						field: e.path.join('.'),
						message: e.message,
					})),
				)
			}
		}

		if (schemas.query) {
			const result = schemas.query.safeParse(req.query)
			if (!result.success) {
				errors.push(
					...result.error.errors.map(e => ({
						source: 'query',
						field: e.path.join('.'),
						message: e.message,
					})),
				)
			}
		}

		if (errors.length > 0) {
			res.status(400).json({ error: 'Validation failed', details: errors })
			return
		}
		next()
	}
}

const paramsSchema = z.object({ id: z.string().uuid('Invalid user ID format') })

const querySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
})

router.get('/', validate({ query: querySchema }), (req, res) => {
	/* ... */
})
router.get('/:id', validate({ params: paramsSchema }), (req, res) => {
	/* ... */
})
```

> `z.coerce.number()` конвертирует строку `"2"` из query-параметра в число. Работает независимо от того, `simple` или `extended` у тебя парсер запроса — но если схема ожидает **вложенный** объект из query (`filter.status`), а парсер `simple` (дефолт Express 5), то `req.query` придёт с плоским ключом `"filter[status]"`, и zod-схема с вложенной структурой не смэтчится. См. предупреждение про query parser в [разделе 4](#4-routing-router-параметры-вложенные-роуты).

### Схемы: переиспользование

```ts
const userBase = z.object({
	name: z.string().min(2).max(100).trim(),
	email: z.string().email().trim().toLowerCase(),
})

export const createUserSchema = userBase
export const updateUserSchema = userBase.partial()
export const userResponseSchema = userBase.extend({
	id: z.string().uuid(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
})

export type CreateUserDto = z.infer<typeof createUserSchema>
export type UpdateUserDto = z.infer<typeof updateUserSchema>
export type UserResponse = z.infer<typeof userResponseSchema>
```

| Метод                       | Что делает                 |
| --------------------------- | -------------------------- |
| `.partial()`                | Все поля → optional        |
| `.required()`               | Все поля → required        |
| `.extend({ ... })`          | Добавить поля              |
| `.pick({ name: true })`     | Оставить только указанные  |
| `.omit({ password: true })` | Убрать указанные           |
| `.merge(otherSchema)`       | Объединить с другой схемой |

### 🎯 На собесе

**Q: Зачем валидация на бэкенде, если фронтенд уже валидирует?**

✅ «Фронтенд-валидация — UX. Бэкенд — безопасность. Запрос может прийти не из браузера: curl, атакующий, другой сервис. Фронт можно обойти — бэкенд нет.»

**Q: Зачем zod вместо ручной проверки?**

✅ «Ручная валидация не масштабируется. Zod даёт рантайм-валидацию + TypeScript-типы из одной схемы (`z.infer`) + переиспользование (`.partial()`, `.extend()`, `.pick()`).»

---

## 7. Конфигурация: env → config → application

### Зачем

Конфигурация различается между окружениями и **не должна** жить в коде:

| Переменная     | Dev                              | Prod                                   |
| -------------- | -------------------------------- | -------------------------------------- |
| `PORT`         | `3000`                           | задаёт платформа                       |
| `DATABASE_URL` | `postgres://localhost/omnia_dev` | `postgres://user:pass@prod-host/omnia` |
| `JWT_SECRET`   | `dev-secret-123`                 | длинный рандом                         |
| `NODE_ENV`     | `development`                    | `production`                           |

Причины: секреты не попадают в git, один код работает в dev/staging/prod, 12-Factor App (фактор III: Config).

### Антипаттерн: process.env по всему коду

```ts
// ⛔ Плохо — process.env раскидан по файлам, нет единого источника правды
function connectDb() {
	return createConnection(process.env.DATABASE_URL) // может быть undefined
}

function verifyToken(token: string) {
	return jwt.verify(token, process.env.JWT_SECRET!) // ! — надежда, а не гарантия
}
```

Проблема не только в дублировании: если переменная опечатана в одном месте (`process.env.JWT_SECRET` vs `process.env.JWT_SECRETT`) — TypeScript не поймает, приложение упадёт в рантайме на первом реальном запросе, а не при старте.

### Правильная структура: env.ts → config → application

```
src/
├── config/
│   ├── env.ts       # Читает process.env, валидирует через zod, ничего больше не знает
│   └── index.ts      # Экспортирует готовый typed config для остального приложения
├── app.ts
└── server.ts
```

```ts
// src/config/env.ts — единственное место, где вообще упоминается process.env
import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
	PORT: z.coerce.number().default(3000),
	NODE_ENV: z
		.enum(['development', 'production', 'test'])
		.default('development'),
	JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
	DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
	console.error('❌ Invalid environment variables:')
	console.error(parsed.error.flatten().fieldErrors)
	process.exit(1)
}

export const env = parsed.data
```

```ts
// src/config/index.ts — то, что импортирует остальное приложение
import { env } from './env.js'

export const config = {
	port: env.PORT,
	isProd: env.NODE_ENV === 'production',
	auth: {
		jwtSecret: env.JWT_SECRET,
	},
	db: {
		url: env.DATABASE_URL,
	},
} as const
```

```ts
// Остальной код НИКОГДА не трогает process.env напрямую:
import { config } from './config/index.js'

function verifyToken(token: string) {
	return jwt.verify(token, config.auth.jwtSecret) // typed, гарантированно строка ≥32 символов
}
```

Выгода такой структуры вылезет в NestJS почти сразу: `ConfigModule` там делает буквально то же самое (читает env, валидирует, отдаёт typed объект через DI) — ты уже будешь понимать, зачем он нужен, вместо того чтобы воспринимать его как магию.

### dotenv

```bash
npm install dotenv
```

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

> `import 'dotenv/config'` должен быть **первой строкой** в `env.ts` — если какой-то модуль читает `process.env` раньше загрузки dotenv, переменные будут `undefined`.

### .gitignore

```gitignore
.env
.env.local
.env.*.local
!.env.example
```

> Никогда не коммить `.env`, даже «временно». Секрет в истории git скомпрометирован навсегда — нужна ротация.

### 🎯 На собесе

**Q: Как управлять конфигурацией в Node.js приложении?**

✅ «Environment variables через `process.env`, но не напрямую по всему коду — а через единый модуль `config/env.ts`, который читает `process.env` один раз, валидирует через zod и отдаёт typed объект. Остальное приложение импортирует `config`, а не `process.env`. `.env` никогда не коммитится, только `.env.example`. Валидация при старте — fail fast: нет `DATABASE_URL` → приложение падает сразу, не через час.»

---

## 8. Express 4 vs Express 5

Express 5.0 вышел стабильным в октябре 2024. С версии 5.1.0 (март 2025) он стал тегом `latest` на npm — то есть версией по умолчанию при `npm install express`. NestJS 11 использует Express 5 как дефолтный адаптер с января 2025. При этом заметная часть существующих продакшн-кодовых баз всё ещё работает на ветке Express 4.17.x–4.22.x — актуальный EOL для Express 4 официально не объявлен, но команда Express публично называет v5 production-recommended релизом.

**Практический вывод:** Omnia сегодня стартует на Express 5 по умолчанию. Но на собеседованиях и в legacy-проектах ты встретишь Express 4 — держи в голове обе колонки.

|                                        | Express 4                                                                   | Express 5                                         |
| -------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------- |
| Async-ошибки в route handler           | Не ловятся автоматически — нужен try/catch + `next(err)` или `asyncHandler` | Rejected promises перехватываются автоматически   |
| Опциональные параметры пути            | `:id?`                                                                      | `{/:id}` (фигурные скобки)                        |
| Wildcard-роуты                         | `*`, `/*` без имени                                                         | Обязаны иметь имя: `/*splat`, `/{*splat}`         |
| Inline-регулярки в путях (`/:id(\d+)`) | Поддерживались                                                              | Убраны (защита от ReDoS)                          |
| Непереданный опциональный параметр     | Ключ есть, значение `undefined`                                             | Ключ отсутствует в `req.params`                   |
| Дефолтный query-парсер                 | `extended` (`qs`, поддерживает вложенность)                                 | `simple` (`querystring`, только плоские значения) |
| `req.query`                            | Writable                                                                    | Read-only геттер                                  |
| `express.static` dotfiles              | Отдаются по умолчанию                                                       | Игнорируются по умолчанию (`dotfiles: 'ignore'`)  |
| `res.status(code)`                     | Принимает что угодно                                                        | Валидирует integer 100–999, иначе ошибка          |
| Минимальная версия Node.js             | 0.10+ (легаси)                                                              | 18+                                               |

### Что с этим делать прямо сейчас

1. Зафиксируй версию в `package.json` явно — не полагайся на то, что "все туториалы про Express 4, значит и у меня v4":
   ```json
   "dependencies": {
     "express": "^5.2.1"
   }
   ```
2. Если копируешь пример кода из статьи/курса старше 2024 года — проверяй синтаксис опциональных/wildcard параметров перед вставкой, это самое частое место поломки.
3. Если Omnia использует вложенные query-параметры (фильтры, сортировки в виде объектов) — реши сразу, включаешь ли `extended`-парсер (`app.set('query parser', 'extended')`) или проектируешь API так, чтобы вложенность не понадобилась (например, `?sort=name:asc` вместо `?sort[field]=name&sort[dir]=asc`). Второй вариант чаще выигрывает — меньше зависимость от парсера, проще документировать в OpenAPI.
4. В NestJS-фазе (когда дойдёшь до `@nestjs/platform-express`) — не удивляйся тем же самым паттернам wildcard/optional param, если будешь писать raw Express middleware внутри Nest-приложения (`app.use()` в `main.ts` работает точно так же).

---

## 9. Структура Express-проекта

### Почему структура важна

В Week 2 весь сервер — в одном файле. Для учебного проекта нормально. На проде 5000+ строк в одном файле — катастрофа для поддержки. Express не навязывает структуру (в отличие от NestJS), выбирать нужно самому.

### Рекомендуемая структура для Omnia

```
src/week3/
├── app.ts                    # Express app: middleware, роуты, error handler
├── server.ts                 # Entry point: config, listen, graceful shutdown
│
├── config/
│   ├── env.ts                 # process.env → zod-валидация
│   └── index.ts               # typed config для приложения
│
├── routes/
│   ├── users.ts               # Router для /users
│   └── health.ts               # Router для /health
│
├── middleware/
│   ├── errorHandler.ts       # Централизованный error handler
│   ├── validate.ts            # Validation middleware (zod)
│   └── logger.ts               # HTTP-логирование
│
├── schemas/
│   └── user.ts                 # Zod-схемы для User
│
└── errors/
    └── AppError.ts             # Кастомные классы ошибок
```

### Разделение app.ts и server.ts

```ts
// app.ts — создаёт и конфигурирует Express app, НЕ вызывает listen()
import express from 'express'
import cors from 'cors'
import { errorHandler } from './middleware/errorHandler.js'
import { NotFoundError } from './errors/AppError.js'
import usersRouter from './routes/users.js'
import healthRouter from './routes/health.js'

const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.use('/health', healthRouter)
app.use('/api/users', usersRouter)

app.use((req, res, next) => {
	next(new NotFoundError('Route', req.originalUrl))
})

app.use(errorHandler)

export default app
```

```ts
// server.ts — entry point
import { config } from './config/index.js'
import app from './app.js'

const server = app.listen(config.port, () => {
	console.log(`🚀 Server running on http://localhost:${config.port}`)
})

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

Если `app.ts` вызывает `listen()` — тест запустит реальный сервер на порту. С разделением `supertest` использует `app` как handler без реального сервера.

### 🎯 На собесе

**Q: Как структурировать Express-приложение?**

✅ «`server.ts` (entry point + listen + shutdown) отдельно от `app.ts` (middleware + routes) — для тестируемости, `supertest` работает с `app` без запуска сервера. Роуты — через Router в отдельных файлах. Конфигурация — через `config/env.ts` с zod-валидацией, не разбросанный `process.env`. На 10+ модулей — переход на NestJS, который навязывает эту структуру.»

---

## 10. Debugging

Редко изучают целенаправленно, но именно это экономит часы в реальной работе.

### Встроенное логирование Express

```bash
DEBUG=express:* node server.js
```

Покажет весь внутренний трейс: какие middleware зарегистрированы, в каком порядке матчатся роуты, что происходит на каждом этапе. Можно сузить:

```bash
DEBUG=express:router node server.js   # только роутинг
DEBUG=express:application node server.js  # только application-level события
```

### Node.js HTTP-трейсинг

```bash
NODE_DEBUG=http node server.js
```

Показывает низкоуровневые HTTP-события — полезно, когда непонятно, доходит ли запрос до Node вообще, или обрывается раньше (прокси, балансировщик).

### curl как инструмент диагностики, не только для запросов

```bash
curl -v http://localhost:3000/api/users
```

`-v` (verbose) показывает весь HTTP-диалог: заголовки запроса, заголовки ответа, статус — без этого невозможно быстро понять, действительно ли CORS-заголовок вернулся, или проблема в другом месте.

```bash
curl --trace-ascii /dev/stdout http://localhost:3000/api/users
```

`--trace-ascii` — ещё подробнее: показывает сырые байты соединения, полезно при отладке проблем на уровне TCP/TLS, а не только HTTP-семантики (вспомни Неделю 1).

### Практический чек-лист отладки "запрос не работает"

1. `curl -v` — дошёл ли запрос до сервера, что вернулось
2. `DEBUG=express:router` — сматчился ли роут вообще
3. Проверить порядок middleware — не стоит ли `express.json()` после роута
4. Проверить версию Express в `package.json` — воспроизводится ли проблема из-за разницы v4/v5 (см. [раздел 8](#8-express-4-vs-express-5))
5. Залогировать `req.params`/`req.query`/`req.body` прямо в начале хендлера — прежде чем предполагать, что проблема глубже

---

## 11. Production Checklist

Сводный чек-лист — не разбросан по разделам, чтобы можно было пробежаться одним взглядом перед деплоем.

**Express / middleware**

- [ ] `helmet()` подключён первым
- [ ] `app.set('trust proxy', ...)` настроен, если сервер за балансировщиком/прокси (иначе `req.ip` и rate-limit будут работать неверно)
- [ ] `compression()` подключён, если нет Nginx/CDN перед Express
- [ ] Request ID генерируется и прокидывается через весь lifecycle (для трейсинга в логах)
- [ ] Structured logging (не `console.log`) с request ID в каждой записи
- [ ] Body parser лимит осознанно выставлен под реальные payload'ы, не "с запасом"

**Error handling**

- [ ] Stack trace никогда не уходит клиенту в `NODE_ENV=production`
- [ ] Каждая ошибка логируется с correlation/request ID
- [ ] Ошибки, отдаваемые клиенту, санитизированы (никаких деталей БД, путей файловой системы, внутренних сообщений)

**Zod / валидация**

- [ ] Валидируются не только `body`, но и `params`, `query`
- [ ] Заголовки, влияющие на бизнес-логику (не считая стандартных типа `Authorization`), тоже валидируются, если на них что-то завязано

**Конфигурация**

- [ ] Приложение падает при старте (`process.exit(1)`), если обязательная env-переменная отсутствует
- [ ] `.env` в `.gitignore`, в репозитории только `.env.example`
- [ ] Версия Express зафиксирована точно в `package.json`, не диапазоном "любая новая мажорная"

---

## 12. 🎯 Шпаргалка для собеседования

| Вопрос                                   | Ключ к ответу                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Что такое Express?                       | Тонкая обёртка над `http.createServer()`. Middleware pipeline + routing + расширенные req/res                                   |
| Что возвращает `express()`?              | Функция `(req, res) => void`, совместимая с `createServer()`                                                                    |
| `res.json()` vs `res.send()`?            | `json()` — явно JSON, корректно обрабатывает null/undefined. `send()` — универсальный                                           |
| Что такое middleware?                    | Функция `(req, res, next)`. Либо отвечает, либо вызывает `next()`                                                               |
| Порядок middleware важен?                | Да. `cors` → `json` → routes → error handler. Нарушение = молчаливый баг                                                        |
| `app.use()` vs `app.get()`?              | `use` — любой метод, prefix matching. `get` — только GET, exact matching                                                        |
| Error handling middleware?               | 4 аргумента: `(err, req, res, next)`. Express определяет по `function.length`                                                   |
| Async ошибки — Express 4 vs 5?           | Express 4: не ловятся, нужен try/catch/`asyncHandler`. Express 5: перехватываются автоматически                                 |
| Что изменилось в роутинге в Express 5?   | path-to-regexp 0.1.x → 8.x: `?` → `{}` для опциональных, wildcard требует имени, убраны inline-регулярки                        |
| Дефолтный query-парсер в Express 5?      | `simple` (без вложенности), не `extended` (`qs`) как в v4                                                                       |
| Что такое Router?                        | Мини-приложение: middleware + routes. Монтируется через `app.use(prefix, router)`                                               |
| `mergeParams`?                           | Объединяет параметры родителя и ребёнка при вложенных роутерах                                                                  |
| Зачем zod?                               | Рантайм-валидация + TypeScript-типы из одной схемы. `z.infer<typeof schema>`                                                    |
| `z.coerce`?                              | Конвертирует строку в число/boolean перед валидацией. Нужен для query params                                                    |
| Зачем dotenv + config/env.ts?            | Загрузить `.env`, провалидировать через zod в одном месте, остальной код работает с typed `config`, не с `process.env` напрямую |
| Fail fast?                               | Валидировать env при старте. Нет `DATABASE_URL` → `process.exit(1)` сразу                                                       |
| Зачем разделять app.ts и server.ts?      | Для тестов: supertest работает с app без запуска сервера                                                                        |
| Что такое `express.json()`?              | Встроенный middleware для парсинга JSON body. Лимит 100 КБ по умолчанию — защита от DoS через body                              |
| `helmet` — зачем?                        | Security headers: CSP, HSTS, X-Frame-Options                                                                                    |
| Зачем вообще учить Express перед NestJS? | NestJS построен на тех же концепциях (middleware, routing, request lifecycle), DI и модули добавляются сверху                   |

---

## 13. ✅ Чек-поинт

«Понял, когда...»

- [ ] Можешь объяснить, что делает `express()` под капотом и как связан с `http.createServer`
- [ ] Знаешь разницу `app.use()` vs `app.get()` — prefix vs exact matching
- [ ] Понимаешь, почему порядок middleware критичен, и знаешь каноничный порядок
- [ ] Можешь нарисовать по памяти полный Request Lifecycle (Logger → Helmet → CORS → Body Parser → Auth → Validation → Controller → DB → Response)
- [ ] Умеешь писать error handler с 4 аргументами и знаешь зачем все 4 обязательны
- [ ] Знаешь разницу в обработке async-ошибок между Express 4 и Express 5 — и какая версия у тебя реально стоит в `package.json`
- [ ] Написал zod-схему с `.safeParse()` и middleware `validate()`
- [ ] Знаешь `z.coerce.number()` для query params и `.partial()` для update-схем
- [ ] Валидируешь env через `config/env.ts`, а не читаешь `process.env` по всему коду
- [ ] Разделяешь `app.ts` и `server.ts` и понимаешь зачем (тестируемость)
- [ ] Умеешь структурировать Express-проект: routes/, middleware/, schemas/, errors/, config/
- [ ] Знаешь минимум 3 отличия Express 5 от Express 4 в роутинге (опциональные параметры, wildcard, query-парсер)
- [ ] Умеешь диагностировать "роут не работает" через `DEBUG=express:*` и `curl -v`

---

## 14. Практика

### 🔴 Задание 1: Переписать Week 2 сервер на Express

1. Создай `src/week3/` со структурой из [раздела 9](#9-структура-express-проекта), включая `config/`
2. Установи `express`, `@types/express`, `cors`, `@types/cors`, `dotenv`, `zod`
3. Проверь, какая версия Express реально встала: `npm list express`
4. Перенеси CRUD-эндпоинты `/users` в `routes/users.ts` через Express Router
5. Добавь `/health` в `routes/health.ts`
6. Middleware: `cors()`, `express.json()`, свой `loggerMiddleware` (время ответа через `res.on('finish')`)

**Deliverable:** сервер на Express с тем же API, что и Week 2.

### 🔴 Задание 2: Сломай и почини опциональный параметр

1. Напиши роут с опциональным параметром старым синтаксисом: `router.get('/users/:id/posts/:postId?', handler)`
2. Запусти сервер, наблюдай ошибку при старте
3. Исправь на синтаксис Express 5 (фигурные скобки), убедись что оба варианта запроса (`/users/1/posts` и `/users/1/posts/5`) отрабатывают верно
4. Залогируй `req.params` в обоих случаях, убедись что понимаешь разницу в отсутствии/наличии ключа `postId`

**Deliverable:** рабочий опциональный роут + короткий комментарий в коде, объясняющий, почему старый синтаксис не работал.

### 🔴 Задание 3: Zod-валидация

1. Создай `schemas/user.ts`: `createUserSchema`, `updateUserSchema` (через `.partial()`)
2. Создай `middleware/validate.ts`: middleware-фабрика для валидации body/params/query
3. Добавь валидацию на POST `/users` и PUT `/users/:id`
4. Ответ при ошибке: `{ error: 'Validation failed', details: [{ field, message }] }`

**Deliverable:** невалидный запрос возвращает 400 с детальным описанием ошибок.

### 🔴 Задание 4: Error Handler

1. Создай `errors/AppError.ts` с классами `NotFoundError`, `ValidationError`
2. Создай `middleware/errorHandler.ts` — централизованный error handler
3. Добавь 404 middleware после всех роутов
4. Используй `throw new NotFoundError('User', id)` вместо `res.writeHead(404)`
5. Проверь: `async` хендлер, который бросает ошибку без try/catch — она долетает до error handler? (ответ зависит от версии Express — см. Задание про `npm list express`)

**Deliverable:** все ошибки имеют единый формат `{ error, statusCode }`.

### 🟡 Задание 5: Конфигурация через config/env.ts

1. Создай `.env` и `.env.example`
2. Создай `config/env.ts` с zod-валидацией (PORT, NODE_ENV, JWT_SECRET, DATABASE_URL)
3. Создай `config/index.ts`, экспортирующий typed `config`
4. Убедись, что приложение падает при старте без `JWT_SECRET`
5. Пройдись по всему коду — не осталось ли где-то прямого обращения к `process.env` в обход `config`
6. Добавь `.env` в `.gitignore`

### 🟢 Задание 6: Установка PostgreSQL

Подготовка к месяцу 2:

1. Установи PostgreSQL локально
2. Создай базу `omnia_dev`: `createdb omnia_dev`
3. Подключись через `psql omnia_dev`
4. Добавь `DATABASE_URL=postgres://localhost:5432/omnia_dev` в `.env`

### 🟢 Задание 7 (опционально): Debugging-практика

1. Запусти сервер с `DEBUG=express:*` и найди в логе момент, когда матчится твой роут `/api/users`
2. Сделай запрос через `curl -v` и найди в выводе CORS-заголовки
3. Намеренно сломай порядок middleware (передвинь `express.json()` после роутов), воспроизведи баг "req.body undefined", почини
