# Неделя 1 · HTTP & сети

> Полный разбор от нуля до уровня собеседования. Каждая тема с объяснением «зачем» и «как под капотом».

---

## Содержание

1. [Модель OSI — зачем бэкендеру](#1-модель-osi)
2. [DNS — система доменных имён](#2-dns)
3. [TCP vs UDP — транспортный уровень](#3-tcp-vs-udp)
4. [HTTPS, TLS, сертификаты](#4-https-tls-сертификаты)
5. [Полный путь запроса от браузера до сервера](#5-полный-путь-запроса)
6. [HTTP Keep-Alive и переиспользование соединений](#6-http-keep-alive)
7. [Анатомия HTTP-запроса и ответа](#7-анатомия-http)
8. [Заголовки, которые обязан знать бэкендер](#8-заголовки)
9. [HTTP-методы: семантика и идемпотентность](#9-http-методы)
10. [PUT vs PATCH — полная замена vs частичное обновление](#10-put-vs-patch)
11. [Idempotency-Key — защита от дублей](#11-idempotency-key)
12. [Status Codes — коды ответов](#12-status-codes)
13. [URL, Path Params, Query Params](#13-url-params)
14. [Иерархия серверов в Node.js](#14-иерархия-серверов)
15. [Шпаргалка для собеседования](#15-шпаргалка)
16. [Чек-поинт](#16-чек-поинт)

---

## 1. Модель OSI

### Зачем бэкендеру знать OSI

Модель OSI (Open Systems Interconnection) — теоретическая модель из 7 уровней, описывающая как данные путешествуют по сети. **Все 7 уровней запоминать не нужно.** Бэкендеру критично различать два:

| Уровень | Название | Что делает | Примеры протоколов |
|---|---|---|---|
| **L4** | Transport | Доставка пакетов между устройствами. Работает с IP-адресами и портами. **Ничего не знает** о содержимом (JSON, HTML, картинка — всё равно) | TCP, UDP |
| **L7** | Application | Логика приложения. Данные уже собраны в осмысленный формат | HTTP, WebSocket, SMTP, gRPC |

### Почему это важно на практике

Когда ты настраиваешь **Nginx** или **балансировщик нагрузки**, тебе скажут: «L4 балансировка» или «L7 балансировка». Разница:

- **L4 балансировщик** смотрит только на IP и порт. Не знает, какой URL запрашивают. Быстрый, но тупой.
- **L7 балансировщик** (Nginx, HAProxy, Cloudflare) парсит HTTP-заголовки. Может отправить `/api/*` на один сервер, а `/static/*` — на другой. Умный, но чуть медленнее.

🎯 **На собесе:** «Чем L4 балансировка отличается от L7?» → «L4 работает на уровне TCP — видит только IP и порт, не знает содержимое. L7 парсит HTTP — может маршрутизировать по URL, заголовкам, cookies. L7 медленнее, но гибче.»

---

## 2. DNS

### Что такое DNS

DNS (Domain Name System) — распределённая база данных, которая переводит доменное имя (`api.omnia.com`) в IP-адрес (`104.20.5.1`). Компьютеры общаются по IP, люди — по именам.

### Как работает DNS Resolution — пошагово

Когда твой код делает `fetch('https://api.omnia.com/users')`:

```
1. Локальный кэш ОС
   → «Я недавно ходил на api.omnia.com? Помню IP?»
   → Если да — готово (0 мс)

2. Файл /etc/hosts
   → Захардкожены ли какие-то домены? (127.0.0.1 localhost)
   → Если нашёл — готово

3. DNS-сервер провайдера (ISP)
   → «Знаешь IP для api.omnia.com?»
   → Если в кэше провайдера — готово (5-20 мс)

4. Рекурсивный запрос по цепочке:
   Root DNS («.»)
     → «Кто отвечает за .com?»
   TLD DNS (.com)
     → «Кто отвечает за omnia.com?»
   Authoritative NS (omnia.com)
     → «IP для api.omnia.com = 104.20.5.1»
   → (50-200 мс в худшем случае)
```

### Типы DNS-записей — знать бэкендеру

| Тип | Что хранит | Пример | Зачем бэкендеру |
|---|---|---|---|
| **A** | IPv4-адрес | `api.omnia.com → 104.20.5.1` | Основной тип. Указывает на сервер |
| **AAAA** | IPv6-адрес | `api.omnia.com → 2606:4700::...` | IPv6 аналог A-записи |
| **CNAME** | Алиас на другой домен | `www.omnia.com → omnia.com` | Редиректы, CDN |
| **MX** | Почтовый сервер | `omnia.com → mail.google.com` | Настройка email |
| **TXT** | Произвольный текст | SPF, DKIM записи | Верификация домена, email-безопасность |

### TTL — Time To Live

Каждая DNS-запись имеет TTL — сколько секунд она кэшируется. Типичные значения:
- 300 секунд (5 минут) — для A-записей (можно быстро переключить сервер)
- 86400 секунд (24 часа) — для MX-записей (почта меняется редко)

**Подводный камень при деплое:** Если ты переключил DNS на новый IP (например, мигрировал на Railway), пользователи с закэшированным старым IP будут ходить на старый сервер до истечения TTL. Решение: заранее уменьшить TTL до 60 секунд, подождать, переключить, потом вернуть TTL обратно.

### Инструменты для дебага DNS

```bash
# Узнать IP домена
dig api.omnia.com

# Подробный вывод с TTL
dig api.omnia.com +noall +answer

# Проверить MX-записи
dig omnia.com MX

# Через nslookup (работает везде)
nslookup api.omnia.com
```

🎯 **На собесе:** «Что произойдёт, если DNS-сервер недоступен?» → «Если запись есть в локальном кэше ОС — ничего не сломается (до истечения TTL). Если кэша нет — все HTTP-запросы к этому домену будут падать с ошибкой ENOTFOUND. Решение: DNS-caching на уровне приложения или использование нескольких DNS-провайдеров.»

---

## 3. TCP vs UDP

### Зачем знать разницу

Перед тем как отправить HTTP-запрос, нужно выбрать **способ доставки** на транспортном уровне (L4). HTTP работает поверх TCP. Но понимание UDP нужно для общего кругозора и собеседований.

### TCP (Transmission Control Protocol)

Протокол с **гарантией доставки**. Работает как заказное письмо — ты знаешь, что оно дойдёт.

**3-Way Handshake — установка соединения:**

```
Клиент                    Сервер
  │                          │
  │──── SYN ────────────────→│  «Хочу подключиться»
  │                          │
  │←─── SYN-ACK ────────────│  «Слышу тебя, готов»
  │                          │
  │──── ACK ────────────────→│  «Подтверждаю, поехали!»
  │                          │
  │    ═══ Соединение ═══    │
```

**Гарантии TCP:**
1. **Доставка** — если пакет потерялся, TCP автоматически запросит повторную отправку (retransmission)
2. **Порядок** — пакеты собираются строго в порядке отправки (через sequence numbers)
3. **Целостность** — контрольная сумма проверяет, что данные не повреждены
4. **Контроль потока** — если получатель не успевает обрабатывать, отправитель замедляется (flow control)

**Где используется:** HTTP/HTTPS, PostgreSQL, SSH, SMTP — везде, где потеря одного байта критична.

**Цена гарантий:** Handshake добавляет 1 RTT задержки. Retransmission добавляет задержки при потерях. Для real-time — это слишком медленно.

### UDP (User Datagram Protocol)

Протокол **без гарантий** (fire-and-forget — «выстрелил и забыл»).

**Нет гарантий:**
- Нет handshake — начинает отправку сразу
- Нет гарантии доставки — пакет потерялся? Ну и ладно
- Нет гарантии порядка — пакеты могут прийти в любом порядке
- Нет retransmission — приложение само решает, что делать с потерями

**Где используется:**
- **DNS-запросы** — маленький пакет, можно переспросить если не ответили
- **Видеозвонки (WebRTC, Zoom)** — лучше пропустить кадр, чем ждать retransmission и лагать
- **Онлайн-игры** — позиция игрока через 200 мс уже неактуальна
- **QUIC (HTTP/3)** — новый протокол, который строит гарантии поверх UDP (быстрее чем TCP+TLS)

### Сравнительная таблица

| Критерий | TCP | UDP |
|---|---|---|
| Соединение | 3-way handshake | Нет |
| Гарантия доставки | Да (retransmission) | Нет |
| Порядок пакетов | Гарантирован | Не гарантирован |
| Скорость | Медленнее (overhead) | Быстрее |
| Использование | HTTP, PostgreSQL, SSH | DNS, видео, игры, QUIC |

🎯 **На собесе:** «Почему HTTP работает поверх TCP, а не UDP?» → «HTTP требует гарантии доставки и порядка — потеря одного байта JSON сломает весь ответ. TCP обеспечивает это автоматически. Хотя HTTP/3 (QUIC) технически работает поверх UDP, он реализует свои гарантии доставки в user-space, фактически воспроизводя поведение TCP, но быстрее за счёт объединённого handshake.»

---

## 4. HTTPS, TLS, сертификаты

### Зачем нужен HTTPS

**HTTP** передаёт данные **в открытом виде**. Любой маршрутизатор на пути от клиента до сервера может прочитать содержимое — пароли, токены, персональные данные. Это атака **Man-in-the-Middle** (MITM).

**HTTPS** = HTTP + TLS. Весь HTTP-трафик оборачивается в криптографический туннель.

В 2026 году HTTP без S — моветон. Браузеры помечают HTTP-сайты как «Not Secure». Let's Encrypt выдаёт сертификаты бесплатно.

### SSL vs TLS — терминология

- **SSL** (Secure Sockets Layer) — старый, уязвимый, **не используется** с 2015 года. Но термин прижился: «SSL-сертификат», «SSL offloading».
- **TLS** (Transport Layer Security) — современный протокол. Актуальная версия: **TLS 1.3** (с 2018, значительно быстрее и безопаснее TLS 1.2).

На практике: когда говорят «SSL-сертификат» — имеют в виду TLS-сертификат.

### TLS Handshake — как устанавливается шифрование

После TCP-соединения (3-way handshake) начинается TLS handshake:

```
Клиент                              Сервер
  │                                    │
  │──── ClientHello ──────────────────→│
  │  «Поддерживаю TLS 1.3,            │
  │   шифры: AES-256-GCM, ...»        │
  │                                    │
  │←─── ServerHello + Certificate ─────│
  │  «Выбрал TLS 1.3 + AES-256-GCM.   │
  │   Вот мой сертификат (паспорт).»   │
  │                                    │
  │  Клиент ПРОВЕРЯЕТ сертификат:      │
  │  1. Выдан доверенным CA?           │
  │  2. Не истёк?                      │
  │  3. Принадлежит этому домену?      │
  │                                    │
  │──── Key Exchange ─────────────────→│
  │  Генерация общего секретного       │
  │  ключа (Symmetric Key) через       │
  │  алгоритм Diffie-Hellman           │
  │                                    │
  │  ════ Канал зашифрован ════        │
  │  Все HTTP-данные шифруются         │
  │  этим симметричным ключом          │
```

**Почему два типа шифрования?**
- **Асимметричное** (публичный/приватный ключ) — используется только для обмена ключами. Медленное, но позволяет безопасно договориться о ключе.
- **Симметричное** (один общий ключ) — используется для шифрования данных. Быстрое (AES-256 работает почти на скорости процессора).

### Сертификаты — цифровые паспорта

**Сертификат** содержит:
- Публичный ключ сервера
- Доменное имя (для кого выдан)
- Кто выдал (Certificate Authority — CA)
- Срок действия
- Цифровую подпись CA

**Certificate Authority (CA)** — доверенная организация, которая проверяет владельца домена и выдаёт сертификат. Примеры: Let's Encrypt (бесплатный), DigiCert, Cloudflare.

**Цепочка доверия:** Браузер доверяет ~100 корневым CA. CA подписывает сертификат сервера. Браузер проверяет подпись → доверяет серверу.

### TLS 1.3 vs TLS 1.2 — почему 1.3 быстрее

| Критерий | TLS 1.2 | TLS 1.3 |
|---|---|---|
| Handshake RTT | 2 RTT | **1 RTT** (или 0 RTT при повторном) |
| Устаревшие шифры | Поддерживает (RSA, CBC) | **Убраны** — только безопасные |
| 0-RTT resumption | Нет | Да (повторное подключение без handshake) |

TLS 1.3 объединяет шаги handshake → экономит 1 RTT. При повторном подключении к серверу (0-RTT) — данные отправляются **сразу** с первым пакетом.

🎯 **На собесе:** «Как работает HTTPS?» → «После TCP-соединения клиент и сервер выполняют TLS handshake: обмениваются поддерживаемыми шифрами, сервер присылает сертификат, клиент проверяет его подлинность через CA. Через Diffie-Hellman генерируется общий симметричный ключ, которым шифруются все дальнейшие HTTP-данные. TLS 1.3 делает это за 1 RTT, TLS 1.2 — за 2.»

---

## 5. Полный путь запроса

### От `fetch()` до JSON в браузере — 6 шагов

Когда фронтенд делает `fetch('https://api.omnia.com/users')`:

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. DNS Resolution                                          ~20 мс │
│     api.omnia.com → 104.20.5.1                                     │
│                                                                     │
│  2. TCP Handshake (L4)                                      1 RTT  │
│     SYN → SYN-ACK → ACK (порт 443)                                │
│                                                                     │
│  3. TLS Handshake                                        1-2 RTT   │
│     ClientHello → ServerHello + Cert → Key Exchange                │
│                                                                     │
│  4. HTTP Request (L7)                                     0.5 RTT  │
│     GET /users HTTP/1.1 (зашифрован)                               │
│     → Nginx (SSL offloading, rate limit)                           │
│     → Node.js (port 3000)                                          │
│                                                                     │
│  5. Server Processing                                    5-500 мс  │
│     Event Loop → middleware → handler → PostgreSQL → JSON          │
│                                                                     │
│  6. HTTP Response (L7)                                    0.5 RTT  │
│     200 OK + JSON (зашифрован обратно)                             │
│     → Nginx → клиент                                               │
└─────────────────────────────────────────────────────────────────────┘

Итого на холодный (первый) запрос: 3-4 RTT + время сервера
```

### Роль Reverse Proxy (Nginx)

На проде перед Node.js почти всегда стоит reverse proxy:

```
Клиент → [Nginx :443] → [Node.js :3000]
```

**Что делает Nginx:**
1. **SSL Offloading** — Nginx расшифровывает TLS, чтобы не нагружать Node.js криптографией
2. **Static files** — отдаёт CSS/JS/изображения сам, не трогая Node.js
3. **Rate Limiting** — ограничивает количество запросов (защита от DDoS)
4. **Gzip/Brotli** — сжимает ответы
5. **Request size limit** — не пропускает тело > N МБ (защита от memory bomb)
6. **Load Balancing** — распределяет запросы между несколькими Node.js процессами

🎯 **На собесе:** «Что будет если Node.js не ответил за 30 секунд, а перед ним Nginx?» → «Nginx вернёт клиенту **504 Gateway Timeout**. При этом Node.js может продолжить обработку запроса (утечка ресурсов). Решение: выставлять таймаут и на стороне Node.js тоже, чтобы abort'ить операцию.»

---

## 6. HTTP Keep-Alive

### Проблема: дорогое соединение

Установка TCP + TLS стоит 3-4 RTT. Если каждый запрос создаёт новое соединение:

```
Запрос 1: DNS + TCP + TLS + HTTP = 4 RTT
Запрос 2: DNS + TCP + TLS + HTTP = 4 RTT    ← повторная работа!
Запрос 3: DNS + TCP + TLS + HTTP = 4 RTT    ← повторная работа!
```

### Решение: Keep-Alive

В HTTP/1.1 по умолчанию включен `Connection: keep-alive`. После ответа сервер **не закрывает** TCP-соединение. Следующий запрос к этому же серверу летит по уже открытому каналу:

```
Запрос 1: DNS + TCP + TLS + HTTP = 4 RTT
Запрос 2:                    HTTP = 1 RTT    ← переиспользует соединение!
Запрос 3:                    HTTP = 1 RTT    ← переиспользует соединение!
```

### Подводный камень для бэкенда

Когда твой Node.js сервер делает запросы к внешним сервисам (OpenAI API, микросервисы), по умолчанию `fetch` или `axios` могут закрывать соединения после каждого запроса. Нужно убедиться, что используется HTTP Agent с `keepAlive: true`:

```typescript
import { Agent } from 'node:https';

const agent = new Agent({
  keepAlive: true,         // переиспользовать соединения
  maxSockets: 50,          // макс. одновременных соединений к одному хосту
  keepAliveMsecs: 30_000,  // держать idle-соединение 30 секунд
});

// Передать агент в fetch/axios
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  agent,
  // ...
});
```

Без этого: каждый запрос к OpenAI = новый TCP + TLS handshake = лишние ~100 мс.

---

## 7. Анатомия HTTP

### HTTP — текстовый протокол

HTTP — это **текст**, который летит по TCP-сокету. Не бинарный формат, не XML, а **простые строки**. Это можно увидеть глазами через `net.createServer()` — сырые байты после `.toString()` превращаются в читаемый текст.

### Структура HTTP-запроса

Запрос состоит из трёх частей, разделённых `\r\n`:

```
POST /api/workspaces/42/agents?status=active HTTP/1.1\r\n   ← Start line
Host: api.omnia.com\r\n                                     ← Headers
Authorization: Bearer eyJhbGciOi...\r\n
Accept: application/json\r\n
Content-Type: application/json\r\n
Content-Length: 21\r\n
\r\n                                                         ← Пустая строка!
{"name": "Sales Bot"}                                       ← Body
```

| Часть | Что содержит | Пример |
|---|---|---|
| **Start line** | Метод + URL + версия HTTP | `GET /users HTTP/1.1` |
| **Headers** | key: value пары (метаданные) | `Content-Type: application/json` |
| **Body** | Тело (только для POST/PUT/PATCH) | `{"name": "Alex"}` |

**Критично:** между headers и body — **пустая строка** (`\r\n\r\n`). Без неё клиент/сервер не поймёт, где заканчиваются заголовки и начинается body.

### Структура HTTP-ответа

```
HTTP/1.1 201 Created\r\n                                    ← Status line
Content-Type: application/json; charset=utf-8\r\n           ← Headers
Location: /api/agents/73\r\n
X-Request-Id: req_a1b2c3\r\n
Content-Length: 52\r\n
\r\n                                                        ← Пустая строка
{"id": 73, "name": "Sales Bot", "status": "draft"}         ← Body
```

### Парсинг запроса руками — как работает Express под капотом

```javascript
const raw = data.toString();

// 1. Разделить headers и body по пустой строке
const [head, ...bodyParts] = raw.split('\r\n\r\n');
const body = bodyParts.join('\r\n\r\n'); // body может содержать \r\n\r\n

// 2. Распарсить start line
const lines = head.split('\r\n');
const [method, url, httpVersion] = lines[0].split(' ');
// method = 'POST', url = '/api/agents?status=active', httpVersion = 'HTTP/1.1'

// 3. Распарсить заголовки
const headers = {};
for (let i = 1; i < lines.length; i++) {
  const colonIndex = lines[i].indexOf(':');
  // indexOf, НЕ split — значение может содержать ':'
  // Пример: "Authorization: Bearer eyJ:abc" — split(':') сломает значение
  const key = lines[i].slice(0, colonIndex).trim().toLowerCase();
  // toLowerCase() — HTTP headers case-insensitive!
  const value = lines[i].slice(colonIndex + 1).trim();
  headers[key] = value;
}
```

**⚠ Подводный камень TCP:** Событие `'data'` на TCP-сокете может прийти **несколько раз** для одного HTTP-запроса. TCP гарантирует порядок и доставку, но **не** гарантирует, что весь запрос прилетит одним куском (chunking). `http.createServer()` собирает чанки автоматически.

🎯 **На собесе:** «Что происходит внутри Express при `app.get('/users', handler)`?» → «Express поверх http.createServer() слушает TCP-сокет. Node.js парсит входящий текст (start line, headers, body) в объекты req и res. Express прогоняет req через цепочку middleware, сопоставляет URL с зарегистрированными маршрутами, вызывает matching handler. `res.json()` = JSON.stringify + Content-Type header + Content-Length + запись в сокет.»

---

## 8. Заголовки

### Заголовки запроса (ты читаешь)

| Header | Зачем | Пример | Где в Omnia |
|---|---|---|---|
| `Content-Type` | Формат тела запроса | `application/json` | Все POST/PATCH эндпоинты |
| `Authorization` | Токен аутентификации | `Bearer eyJ...` | Все защищённые эндпоинты |
| `Accept` | Какой формат ответа хочет клиент | `application/json` | Для content negotiation |
| `Idempotency-Key` | Защита от дублей | `uuid-v4-string` | Создание оплаты, агента |
| `X-Request-Id` | Трассировка запроса через систему | `req_a1b2c3` | Логирование, дебаг на проде |
| `User-Agent` | Кто делает запрос | `Mozilla/5.0...` | Аналитика, блокировка ботов |

### Заголовки ответа (ты выставляешь)

| Header | Зачем | Когда | Пример |
|---|---|---|---|
| `Content-Type` | Формат тела ответа | **Всегда** (кроме 204) | `application/json; charset=utf-8` |
| `Content-Length` | Длина тела **в байтах** | **Всегда** когда есть body | `Buffer.byteLength(body)` |
| `Location` | URL созданного ресурса | После `201 Created` | `/api/agents/73` |
| `Retry-After` | Через сколько секунд повторить | При `429` или `503` | `30` |
| `Cache-Control` | Кэширование ответа | GET-эндпоинты | `public, max-age=3600` |
| `X-Request-Id` | Эхо ID для дебага | **Всегда** (прод must-have) | `req_a1b2c3` |
| `Set-Cookie` | Установка куки | Auth-сценарии | `session=abc; HttpOnly; Secure` |
| `Allow` | Допустимые методы | При `405 Method Not Allowed` | `GET, POST` |

### 🔴 Content-Length — байты, не символы!

```typescript
const body = JSON.stringify({ name: 'Дмитрий' });

// ❌ body.length = 21 (символы JavaScript — UTF-16 code units)
// ✅ Buffer.byteLength(body) = 27 (UTF-8 байты, кириллица = 2 байта на символ)

res.setHeader('Content-Length', Buffer.byteLength(body));
```

Неправильный Content-Length → клиент обрежет ответ или зависнет, ожидая ещё байты.

### Заголовок `Location` при 201 Created

Когда бэкенд создаёт ресурс, `Location` указывает клиенту URL нового ресурса:

```http
POST /api/agents  →  HTTP/1.1 201 Created
                     Location: /api/agents/73
                     Content-Type: application/json

                     {"id": 73, "name": "Sales Bot"}
```

Клиент может сделать `GET /api/agents/73` чтобы получить полную сущность. Фронтенд-фреймворки (Apollo, TanStack Query) используют Location для обновления кэша.

### Заголовок `Retry-After` при 429

Говорит клиенту, сколько **секунд** ждать перед повторным запросом:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30

{"error": "Rate limit exceeded", "retryAfter": 30}
```

`Retry-After` может быть числом (секунды) или HTTP-Date. На бэкенде безопаснее отдавать секунды — меньше ошибок с часовыми поясами.

---

## 9. HTTP-методы

### Семантика методов

| Метод | Семантика | Тело | Идемпотентный? | Безопасный? |
|---|---|---|---|---|
| **GET** | Получить ресурс | Нет | ✅ Да | ✅ Да (только чтение) |
| **POST** | Создать ресурс | Да | ❌ Нет | ❌ Нет |
| **PUT** | Полностью заменить ресурс | Да | ✅ Да | ❌ Нет |
| **PATCH** | Частично обновить ресурс | Да | ⚠ Зависит | ❌ Нет |
| **DELETE** | Удалить ресурс | Нет (обычно) | ✅ Да | ❌ Нет |
| **HEAD** | GET без body (только headers) | Нет | ✅ Да | ✅ Да |
| **OPTIONS** | Какие методы разрешены | Нет | ✅ Да | ✅ Да |

### Идемпотентность — что это и зачем

**Идемпотентность** — свойство операции: сколько бы раз ни повторил запрос, **состояние сервера** (данные в БД) не изменится после первого успешного выполнения.

Зачем: сеть ненадёжна. Клиент отправил запрос → не получил ответ (таймаут, обрыв соединения) → не знает, выполнился ли запрос → делает **retry**. Если метод идемпотентен — retry безопасен.

**GET** — идемпотентен:
```
GET /users — прочитать хоть 1000 раз — база не изменится
```

**PUT** — идемпотентен:
```
PUT /users/1 { name: "Alex" }
→ Отправь 10 раз — в базе будет "Alex". Не "AlexAlexAlex"
```

**DELETE** — идемпотентен:
```
DELETE /users/1
→ Первый запрос удалит. Второй — 404 (или 200). Но user всё ещё удалён.
```

**POST** — ❌ **НЕ** идемпотентен:
```
POST /payments { amount: 100 }
→ 5 retry'ев = 5 списаний = 500 долларов. КАТАСТРОФА.
```

**PATCH** — ⚠ зависит от реализации:
```
PATCH /users/1 { name: "Alex" }         ← идемпотентен (перезапись)
PATCH /users/1 { $increment: { balance: 100 } }  ← НЕ идемпотентен (инкремент)
```

### Безопасные методы (Safe)

**Безопасный** метод не изменяет состояние сервера. Только чтение. GET и HEAD — безопасные. POST, PUT, DELETE — нет.

Зачем: поисковые боты делают GET по всем ссылкам. Если GET изменяет данные — бот может удалить или модифицировать контент. **Никогда не меняй данные через GET.**

```
❌ GET /users/1/delete    — бот зайдёт и удалит пользователя!
✅ DELETE /users/1         — бот не делает DELETE-запросы
```

---

## 10. PUT vs PATCH

### Пример из Omnia

Агент в базе данных:

```json
{
  "id": 73,
  "name": "Sales Bot",
  "model": "gpt-4",
  "temperature": 0.7,
  "systemPrompt": "You are a sales assistant"
}
```

### PUT — полная замена ресурса

PUT означает: «Вот **ВЕСЬ** ресурс. То, чего нет в запросе — не существует.»

```http
PUT /api/agents/73
Content-Type: application/json

{ "name": "Support Bot" }
```

Результат — **пропущенные поля обнулены**:

```json
{
  "id": 73,
  "name": "Support Bot",
  "model": null,
  "temperature": null,
  "systemPrompt": null
}
```

### PATCH — частичное обновление

PATCH означает: «Измени **только** то, что я передал. Остальное не трогай.»

```http
PATCH /api/agents/73
Content-Type: application/json

{ "name": "Support Bot" }
```

Результат — **остальные поля нетронуты**:

```json
{
  "id": 73,
  "name": "Support Bot",
  "model": "gpt-4",
  "temperature": 0.7,
  "systemPrompt": "You are a sales assistant"
}
```

### Сравнительная таблица

| Критерий | PUT | PATCH |
|---|---|---|
| Что отправляешь | **Всю** сущность целиком | **Только** изменённые поля |
| Пропущенные поля | Обнуляются / удаляются | Остаются без изменений |
| Идемпотентность | ✅ Всегда | ⚠ Зависит от реализации |
| Типичное использование | Полное редактирование формы | Инлайн-изменение одного поля |
| Пример в Omnia | Перезапись всех настроек агента | Переключение `isActive: false` |

### Почему на практике в 2026 почти все используют PATCH

1. **Фронтенд редко отправляет ВСЮ форму** — обычно меняется 1-2 поля
2. **PUT требует сначала GET** (получить текущее состояние) → лишний запрос
3. **PUT опасен при lost update problem:**

```
User A: GET /agents/73 → { name: "Bot", model: "gpt-4" }
User B: GET /agents/73 → { name: "Bot", model: "gpt-4" }

User A: PUT /agents/73 { name: "New Bot", model: "gpt-4" }  ← меняет name
User B: PUT /agents/73 { name: "Bot", model: "gpt-4o" }     ← меняет model

Результат: { name: "Bot", model: "gpt-4o" }
Изменение User A ПОТЕРЯНО — B перезаписал всю сущность с СТАРЫМ name
```

С PATCH этой проблемы нет — каждый обновляет только своё поле.

> В Omnia: **PATCH** для 90% обновлений. **PUT** только для полной замены конфига (например, перезапись systemPrompt + всех параметров агента).

---

## 11. Idempotency-Key

### Проблема: POST не идемпотентен

```
Клиент → POST /payments { amount: 100 }
Сервер → списал 100 ₽ → отправил ответ
... ответ потерялся в сети ...
Клиент → «Не получил ответ, повторяю» → POST /payments { amount: 100 }
Сервер → списал ЕЩЁ 100 ₽ 💀
```

### Решение: Idempotency-Key

Индустриальный стандарт (Stripe, Shopify, все платёжные системы).

**Как работает:**

```
Шаг 1: Фронтенд генерирует UUID
        Idempotency-Key: a1b2c3d4-e5f6-7890-abcd-ef1234567890

Шаг 2: Отправляет запрос с этим ключом
        POST /payments
        Idempotency-Key: a1b2c3d4...
        { "amount": 100 }

Шаг 3: Бэкенд ПЕРЕД выполнением проверяет в Redis/БД:
        «Я уже видел ключ a1b2c3d4?»

        ЕСЛИ НЕТ:
        → Выполняет бизнес-логику (списывает деньги)
        → Сохраняет { key: "a1b2c3d4", result: { id: 42, ... } }
        → Возвращает 200 OK + результат

        ЕСЛИ ДА:
        → НЕ выполняет повторно
        → Достаёт сохранённый результат
        → Возвращает тот же 200 OK + тот же результат
```

**Реализация на бэкенде (упрощённо):**

```typescript
async function handlePayment(req, res) {
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header required' });
  }

  // Проверяем в Redis: был ли этот ключ?
  const cached = await redis.get(`idempotency:${idempotencyKey}`);

  if (cached) {
    // Дубль! Возвращаем сохранённый результат
    return res.status(200).json(JSON.parse(cached));
  }

  // Первый раз — выполняем бизнес-логику
  const payment = await processPayment(req.body);

  // Сохраняем результат с TTL (24 часа)
  await redis.set(
    `idempotency:${idempotencyKey}`,
    JSON.stringify(payment),
    'EX', 86400
  );

  return res.status(201).json(payment);
}
```

🎯 **На собесе:** «Как защитить POST от дублей?» → «Паттерн Idempotency-Key. Клиент генерирует UUID, передаёт в заголовке. Сервер перед выполнением проверяет ключ в Redis: если видел — возвращает закэшированный результат без повторного выполнения. TTL 24 часа. Это индустриальный стандарт — так делают Stripe, Shopify.»

---

## 12. Status Codes

### Зачем правильные коды

Фронтенд-фреймворки (fetch, axios, TanStack Query) принимают решения на основе кода:
- `response.ok` = коды 200-299
- 401 → показать логин
- 403 → показать «Нет доступа»
- 429 → ждать `Retry-After` секунд
- 500 → показать «Что-то сломалось»

Неправильный код = сломанный UX.

### 2xx (Success — Успех)

| Код | Когда | Заголовки | Body |
|---|---|---|---|
| **200 OK** | GET, PUT, PATCH — стандартный успех | Content-Type | Результат |
| **201 Created** | POST — ресурс создан | Content-Type + **Location** | Созданный ресурс |
| **204 No Content** | DELETE — успешно, тела нет | Нет Content-Type | Нет body |

```typescript
// 200 — стандартный ответ
res.status(200).json(users);

// 201 — ресурс создан, Location обязателен
res.status(201)
  .setHeader('Location', `/api/agents/${agent.id}`)
  .json(agent);

// 204 — удалено, пустой ответ
res.status(204).end();
```

### 3xx (Redirection — Перенаправление)

| Код | Семантика | Сохраняет метод? | Кэшируется? |
|---|---|---|---|
| **301** Moved Permanently | Навсегда переехал | ❌ Может сменить POST→GET | ✅ Жёстко |
| **302** Found | Временный редирект | ❌ Может сменить POST→GET | ❌ |
| **307** Temporary Redirect | Временный | ✅ Гарантирует | ❌ |
| **308** Permanent Redirect | Навсегда | ✅ Гарантирует | ✅ |
| **304** Not Modified | Кэш актуален | — | — |

**🔴 Разница 301 vs 308:** При 301 браузер **может сменить метод** с POST на GET (историческое поведение). При 308 — метод **гарантированно сохраняется**. Для API-редиректов безопаснее **308**.

### 4xx (Client Error — ошибка клиента)

Здесь самое сложное — **выбрать правильный код**. Примеры из Omnia:

```
400 Bad Request           — Запрос СИНТАКСИЧЕСКИ сломан.
                            Битый JSON, отсутствует обязательное поле,
                            неправильный тип данных.
                            POST /agents body: "не JSON вообще{" → 400

401 Unauthorized          — КТО ТЫ? Не аутентифицирован.
                            Токен отсутствует, протух, подпись невалидна.
                            GET /agents (без Authorization header) → 401
                            Фронт: показать форму логина.

403 Forbidden             — Я ЗНАЮ кто ты, но тебе НЕЛЬЗЯ.
                            Токен валиден, но роль не та.
                            DELETE /workspaces/1 (user.role = "viewer") → 403
                            Фронт: показать «Нет доступа».

404 Not Found             — Ресурс не существует.
                            GET /agents/99999 → 404

405 Method Not Allowed    — URL существует, но этот метод запрещён.
                            DELETE /api/health → 405
                            Обязательно: заголовок Allow: GET

409 Conflict              — Бизнес-логика конфликтует с текущим состоянием.
                            POST /users { email: "alex@test.com" }
                            (email уже в базе) → 409

422 Unprocessable Entity  — Синтаксис ОК, но СЕМАНТИЧЕСКИ бессмысленно.
                            POST /agents { name: "Bot", model: "gpt-99" }
                            (модели gpt-99 не существует) → 422

429 Too Many Requests     — Rate limit сработал.
                            Обязательно: заголовок Retry-After: 30
```

### 🔴 Критические разницы

**400 vs 422:**
- **400** — запрос **синтаксически** сломан: битый JSON, нет обязательного поля, неправильный тип
- **422** — синтаксис ОК, JSON парсится, но данные **семантически** бессмысленны для бизнес-логики: ссылка на несуществующую модель, невозможное сочетание полей

```typescript
// 400 — JSON не парсится
const body = "{ не JSON вообще }";  // → SyntaxError → 400

// 422 — JSON ОК, но данные бессмысленны
const body = { name: "Bot", model: "gpt-99" };  // → gpt-99 не существует → 422
```

**401 vs 403:**
```
401 = «Кто ты?»             → Покажи мне токен.
                               Фронт показывает форму логина.
403 = «Я знаю кто ты, нет»  → У тебя роль viewer, нужен admin.
                               Фронт показывает «Нет доступа».
```

Если перепутать: вернёшь `403` без токена → фронт **не** покажет логин. Вернёшь `401` без прав → фронт будет бесконечно рефрешить токен. **Реальный баг на проде.**

### 5xx (Server Error — виноват бэкендер)

```
500 Internal Server Error — Необработанное исключение в коде Node.js.
                            🔴 НИКОГДА не возвращай стектрейс клиенту:
                            пути файлов, зависимости, фрагменты SQL = вектор атаки.

                            ❌ { "error": "Cannot read property 'id' of undefined",
                                "stack": "at /app/src/handlers/users.ts:42:15..." }

                            ✅ { "error": "Internal server error",
                                "requestId": "req_a1b2c3" }

                            Полный стектрейс — в Pino/Winston логи.

502 Bad Gateway           — Nginx жив, Node.js — НЕТ.
                            Процесс упал, перезагружается, или не запустился.

504 Gateway Timeout       — Node.js жив, но ЗАВИС.
                            Тяжёлый запрос. Nginx не дождался (proxy_timeout).
```

### 🚫 Антипаттерн: `200 + { error: "..." }`

```typescript
// ❌ ПЛОХО — фронтенд фильтрует по response.ok (коды 200-299)
// response.ok будет true → фронт попытается показать данные → крэш
res.status(200).json({ error: "User not found" });

// ✅ ХОРОШО — правильный HTTP-код
// response.ok будет false → фронт покажет ошибку
res.status(404).json({ error: "User not found" });
```

🎯 **На собесе:** «Что вернёшь на POST /users если email занят?» → «409 Conflict. Не 400 (ввод валиден синтаксически). Не 500 (это не баг). 409 — бизнес-конфликт с текущим состоянием.»

---

## 13. URL, Path Params, Query Params

### Правило REST: существительные во множественном числе

```
✅ /api/users           — коллекция пользователей
✅ /api/users/42        — конкретный пользователь
✅ /api/workspaces/1/agents  — агенты внутри workspace

❌ /api/getUsers        — глаголы не нужны (GET УЖЕ говорит «получить»)
❌ /api/user            — единственное число неконсистентно
❌ /api/create-agent    — POST /api/agents уже означает «создать»
```

### Path Params — идентификация конкретного ресурса

Без path param запрос теряет смысл. Это **обязательная** часть URL.

```
GET /api/workspaces/12/agents/5
                   ^^        ^
                   Path Params — уникальные ID
```

```typescript
// Express: /api/agents/:id
// Запрос:  GET /api/agents/42
req.params.id  // => "42" (⚠ СТРОКА, не число!)
```

**Правило:** если ресурс не может существовать или быть найден без этого значения — это Path Param.

### Query Params — фильтрация, сортировка, пагинация

Они **опциональны** — без них вернётся вся коллекция.

```
GET /api/agents?status=active&limit=10&page=2
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
               Query Params — фильтрация, пагинация
```

```typescript
// Запрос: GET /api/agents?status=active
req.query.status  // => "active"
```

### Сравнительная таблица

| Критерий | Path Params `/agents/:id` | Query Params `/agents?status=active` |
|---|---|---|
| **Назначение** | Идентификация конкретного объекта | Фильтрация, сортировка, пагинация |
| **Обязательность** | Обязателен (без него — другой эндпоинт) | Опционален (без него — вся коллекция) |
| **Пример Omnia** | `GET /agents/73` (бот #73) | `GET /agents?model=gpt-4` (GPT-4 боты) |
| **Кэширование** | Кэшируется как отдельный URL | Зависит от настроек CDN |

### 🔴 Подводные камни

#### 1. Парсинг типов — ВСЕГДА String

И Path Params, и Query Params приходят как **строки**. `req.params.id` = `"42"`, не `42`.

```typescript
// ❌ Drizzle/Prisma упадут — ожидают число, получают строку
const agent = await db.select().from(agents).where(eq(agents.id, req.params.id));

// ✅ Явное приведение + валидация
const agentId = parseInt(req.params.id, 10);
if (isNaN(agentId)) {
  return res.status(400).json({ error: 'Invalid agent ID' });
}
```

#### 2. Порядок роутов в Express — статические ПЕРЕД динамическими

```typescript
// ❌ GET /agents/active попадёт сюда, :id станет "active"
app.get('/agents/:id', handler);
app.get('/agents/active', handler);  // НИКОГДА не выполнится

// ✅ Сначала статические, потом динамические
app.get('/agents/active', handler);
app.get('/agents/:id', handler);
```

#### 3. URL Encoding

Спецсимволы и кириллица кодируются: пробел → `%20`, кириллица → `%D0%...`. Express декодирует автоматически. При ручном парсинге — `decodeURIComponent()`.

#### 4. Массивы в Query Params

```
GET /api?tags=node&tags=react
```

Express распарсит как массив: `req.query.tags = ['node', 'react']`. Бэкенд должен быть готов к тому, что параметр может прийти и как строка (один тег), и как массив (несколько).

```typescript
// Универсальная обработка:
const tags = Array.isArray(req.query.tags)
  ? req.query.tags
  : req.query.tags ? [req.query.tags] : [];
```

#### 5. Инъекция через Query Params

```typescript
// ❌ SQL Injection через query param
const query = `SELECT * FROM users WHERE name = '${req.query.name}'`;
// Если name = "'; DROP TABLE users; --" → КАТАСТРОФА

// ✅ Параметризованный запрос
const result = await db.query(
  'SELECT * FROM users WHERE name = $1',
  [req.query.name]
);
```

---

## 14. Иерархия серверов

### От TCP до NestJS — каждый слой = обёртка над предыдущим

```
net.createServer()     ← Голый TCP. Получаешь сырые байты, сам парсишь текст.
  ↓
http.createServer()    ← Node парсит HTTP за тебя → даёт req.method, req.url, req.headers
  ↓
Express(app)           ← Добавляет роутинг, middleware, res.json()
  ↓
NestJS                 ← Добавляет DI, декораторы, модули
```

Каждый уровень — обёртка. `http.createServer()` внутри использует `net.createServer()`. Express внутри использует `http.createServer()`.

### `net.createServer()` — модуль `node:net`

Встроенный модуль для работы с **TCP-сокетами** (L4). Создаёт TCP-сервер, который слушает порт и принимает соединения. Каждое соединение — объект `socket` (двусторонний канал для чтения/записи сырых байтов).

```javascript
import * as net from 'node:net';

const server = net.createServer(socket => {
  // callback вызывается на КАЖДОЕ новое подключение
  // 5 браузеров = 5 вызовов с разными socket-объектами

  socket.on('data', data => {
    // data — Buffer (массив байтов), НЕ строка!
    const text = data.toString(); // UTF-8 → текст
    console.log(text);
    // Увидишь:
    // "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n"
    // ← это HTTP-запрос как СЫРОЙ ТЕКСТ
  });

  // Ответить тоже нужно сырым HTTP-текстом:
  socket.write('HTTP/1.1 200 OK\r\n');
  socket.write('Content-Type: text/plain\r\n');
  socket.write('\r\n');
  socket.write('Hello from raw TCP!');
  socket.end(); // Закрыть соединение
});

server.listen(3000, () => console.log('TCP on :3000'));
```

### `http.createServer()` — модуль `node:http`

Обёртка над `net`. Node.js **сам парсит** HTTP-текст и даёт удобные объекты:

```typescript
import { createServer } from 'node:http';

const server = createServer((req, res) => {
  // req.method   — 'GET', 'POST', ...
  // req.url      — '/api/users?page=2'
  // req.headers  — { 'content-type': 'application/json', ... }

  // req — Readable Stream (для чтения body)
  // res — Writable Stream (для отправки ответа)

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(3000);
```

### Модуль `node:crypto`

Встроенный модуль для криптографии: хеширование, шифрование, генерация случайных значений.

```typescript
import { randomUUID, randomBytes, createHash } from 'node:crypto';

// Генерация UUID v4 (криптографически стойкий)
const id = randomUUID(); // 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

// Криптографически стойкие случайные байты
const token = randomBytes(32).toString('hex');
// '4f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7'
```

**🔴 Никогда не использовать `Math.random()` для токенов/сессий/ID:**

```typescript
// ❌ Math.random() — PRNG (Pseudo-Random Number Generator)
// Предсказуем! Злоумышленник может вычислить следующие значения
// и угнать чужие сессии
const token = Math.random().toString(36).slice(2);

// ✅ crypto — CSPRNG (Cryptographically Secure PRNG)
// Использует entropy pool операционной системы
const token = randomBytes(32).toString('hex');
const uuid = randomUUID();
```

---

## 15. Шпаргалка для собеседования

| Вопрос | Эталонный ответ |
|---|---|
| Чем L4 отличается от L7? | L4 — IP + порт, не знает содержимое. L7 — парсит HTTP, маршрутизирует по URL/заголовкам |
| Как работает DNS? | Домен → IP. Кэш ОС → /etc/hosts → ISP DNS → Root → TLD → Authoritative NS |
| TCP vs UDP? | TCP — гарантии (handshake, порядок, retransmission). UDP — быстрый, без гарантий. HTTP на TCP, видео на UDP |
| Как работает HTTPS? | TCP + TLS handshake: обмен шифрами → сертификат → DH key exchange → симметричное шифрование |
| TLS 1.3 vs 1.2? | 1.3: 1 RTT (vs 2), 0-RTT resumption, убраны старые шифры |
| 401 vs 403? | 401 = не аутентифицирован (нет токена). 403 = аутентифицирован, но нет прав |
| 400 vs 422? | 400 = синтаксически сломан. 422 = синтаксис ОК, семантически бессмысленно |
| POST /users если email занят? | 409 Conflict (не 400, не 500) |
| PUT vs PATCH? | PUT = полная замена (пропущенные поля обнуляются). PATCH = частичное обновление |
| Что такое идемпотентность? | Повторный запрос не меняет состояние сервера. GET/PUT/DELETE — да. POST — нет |
| Как защитить POST от дублей? | Idempotency-Key: UUID в заголовке → проверка в Redis → возврат кэшированного результата |
| Path vs Query params? | Path = идентификация (обязательный). Query = фильтрация/пагинация (опциональный) |
| Что внутри Express? | http.createServer() → парсинг HTTP → middleware chain → route matching → handler |
| net vs http в Node.js? | net = сырые TCP-байты. http = автоматический парсинг HTTP, готовые req/res |
| Math.random() для токенов? | ❌ Предсказуем (PRNG). Только crypto.randomBytes() / randomUUID() (CSPRNG) |
| Node.js не ответил за 30 сек? | Nginx → 504. Node.js может продолжить работу (утечка). Нужен таймаут и на стороне Node |
| Keep-Alive зачем? | Переиспользует TCP+TLS соединение. Экономит 3 RTT на каждом повторном запросе |
| Зачем Location в 201? | URL созданного ресурса. Клиент может сделать GET для получения полной сущности |
| Стектрейс в 500-ке? | ❌ Никогда. Пути файлов, зависимости, SQL = вектор атаки. Только requestId + логи |

---

## 16. Чек-поинт

«Понял, когда...»

- [ ] Можешь объяснить путь запроса от `fetch()` до JSON в браузере (DNS → TCP → TLS → HTTP → Nginx → Node.js → Response)
- [ ] Знаешь разницу TCP vs UDP и почему HTTP на TCP
- [ ] Понимаешь TLS handshake и зачем два типа шифрования (асимметричное для обмена, симметричное для данных)
- [ ] Правильно выбираешь status code для любой ситуации (400 vs 422, 401 vs 403, 409)
- [ ] Объясняешь идемпотентность через retry-сценарий, а не через определение
- [ ] Знаешь паттерн Idempotency-Key и можешь описать реализацию
- [ ] Не путаешь PUT (полная замена) и PATCH (частичное обновление)
- [ ] Понимаешь why `Content-Length` считается через `Buffer.byteLength()`, а не `string.length`
- [ ] Знаешь зачем Keep-Alive и как настроить HTTP Agent для исходящих запросов
- [ ] Можешь распарсить HTTP-запрос руками (start line → headers → body)

---

## Что дальше — практика

После изучения теории → переходи к практическим заданиям:

1. 🔴 **TCP-сервер** — `net.createServer()` → парсинг HTTP вручную → ответ
2. 🔴 **HTTP-сервер** — `http.createServer()` → роутинг, JSON-ответы
3. 🟡 **Status codes drill** — сценарий → правильный код + заголовки
4. 🟡 **cURL** — отправка GET/POST/PUT/PATCH/DELETE с заголовками
