# Неделя 2 · Node.js — движок под капотом

> Полный разбор от нуля до уровня собеседования. Каждая тема с примерами, которые можно запустить.

---

## Содержание

1. [Что такое Node.js и зачем он нужен](#1-что-такое-nodejs)
2. [Event Loop — сердце Node.js](#2-event-loop)
3. [Call Stack, Heap, очереди задач](#3-call-stack-heap-очереди)
4. [Async/Await и Promise — глубокое понимание](#4-asyncawait-и-promise)
5. [Buffers — работа с бинарными данными](#5-buffers)
6. [Streams — потоковая обработка данных](#6-streams)
7. [File System (fs) — работа с файлами](#7-file-system)
8. [Path, OS, Process — системные модули](#8-path-os-process)

---

## 1. Что такое Node.js

### Суть в 5 предложениях

Node.js — это **рантайм** для JavaScript вне браузера. Внутри — движок **V8** (тот же что в Chrome) + библиотека **libuv** (C++), которая даёт доступ к файловой системе, сети, потокам ОС. Node.js **однопоточный** для твоего JS-кода, но **не однопоточный** внутри — libuv использует пул потоков (4 по умолчанию) для блокирующих операций (чтение файлов, DNS, crypto). Это позволяет обрабатывать тысячи одновременных соединений одним процессом.

### Архитектура

```
┌─────────────────────────────────────────┐
│            Твой JavaScript код          │
├─────────────────────────────────────────┤
│          Node.js Bindings (C++)         │
│     (мост между JS и системными API)    │
├──────────────────┬──────────────────────┤
│       V8         │       libuv          │
│  (компиляция JS  │  (Event Loop,        │
│   в машинный     │   async I/O,         │
│   код)           │   thread pool)       │
├──────────────────┴──────────────────────┤
│           Операционная система          │
│     (файлы, сеть, процессы, память)     │
└─────────────────────────────────────────┘
```

**V8** компилирует JS в машинный код (JIT — Just-In-Time compilation). Не интерпретирует — именно компилирует. Поэтому Node.js быстрый.

**libuv** — абстракция над I/O операционной системы:
- На Linux — использует `epoll`
- На macOS — `kqueue`
- На Windows — `IOCP`
- Все они позволяют следить за тысячами сокетов/файлов одновременно без создания потока на каждый

🔗 **Аналогия из фронтенда:** Ты знаешь, что браузер — это не только V8. Есть Web API (DOM, fetch, setTimeout). В Node.js вместо Web API — libuv и встроенные модули (fs, http, net). Тот же принцип: JS-движок + платформенный слой.

🎯 **На собесе:** «Что такое Node.js?» — НЕ говори "это JavaScript на сервере". Скажи: "Это рантайм, построенный на V8 и libuv, который использует event-driven, non-blocking I/O модель для высокой конкурентности при одном потоке JS-кода."

---

## 2. Event Loop

### Зачем это вообще нужно?

Представь обычный сервер (Python, Java, PHP до async):
- Пришёл запрос → создаётся **поток** (thread)
- Поток ждёт ответ от базы данных (100 мс ничего не делает)
- 1000 запросов = 1000 потоков = много памяти + context switching

Node.js решает это иначе:
- Пришёл запрос → JS-код отправляет запрос в базу → **не ждёт**, берёт следующий запрос
- Когда ответ от базы готов → callback вызывается через Event Loop
- 1 поток обрабатывает тысячи запросов

### Фазы Event Loop (подробно)

Event Loop — это **бесконечный цикл**, который проверяет очереди задач по порядку. Каждая итерация называется **tick**.

```
   ┌───────────────────────────────────────────────┐
   │                                               │
   │  ┌─────────────────────────────────────────┐  │
   │  │          1. TIMERS                      │  │
   │  │  Выполняет callback'и setTimeout и      │  │
   │  │  setInterval, у которых время истекло    │  │
   │  └────────────────┬────────────────────────┘  │
   │                   │                           │
   │  ┌────────────────┴────────────────────────┐  │
   │  │      2. PENDING CALLBACKS               │  │
   │  │  I/O callback'и, отложенные с прошлого  │  │
   │  │  цикла (например, ошибки TCP)           │  │
   │  └────────────────┬────────────────────────┘  │
   │                   │                           │
   │  ┌────────────────┴────────────────────────┐  │
   │  │      3. IDLE, PREPARE                   │  │
   │  │  Внутренние операции Node (не трогаем)   │  │
   │  └────────────────┬────────────────────────┘  │
   │                   │                           │
   │  ┌────────────────┴────────────────────────┐  │
   │  │      4. POLL  ★ основная фаза ★         │  │
   │  │  Получает новые I/O события.            │  │
   │  │  Выполняет их callback'и.               │  │
   │  │  Если очередь пуста — ЖДЁТ новые.       │  │
   │  │  Если есть setImmediate — переходит     │  │
   │  │  в Check.                               │  │
   │  └────────────────┬────────────────────────┘  │
   │                   │                           │
   │  ┌────────────────┴────────────────────────┐  │
   │  │      5. CHECK                           │  │
   │  │  Выполняет callback'и setImmediate()    │  │
   │  └────────────────┬────────────────────────┘  │
   │                   │                           │
   │  ┌────────────────┴────────────────────────┐  │
   │  │      6. CLOSE CALLBACKS                 │  │
   │  │  socket.on('close'), server.on('close') │  │
   │  └────────────────┬────────────────────────┘  │
   │                   │                           │
   │         ┌─────────┴──────────┐                │
   │         │  МЕЖДУ ФАЗАМИ:     │                │
   │         │  process.nextTick  │                │
   │         │  Promise.then      │                │
   │         └─────────┬──────────┘                │
   │                   │                           │
   └───────────────────┘  (следующий tick)         │
```

### Каждая фаза детально

#### 1. TIMERS

```javascript
// setTimeout говорит: "вызови меня НЕ РАНЬШЕ чем через N мс"
// Это НЕ гарантия точного времени!
setTimeout(() => {
  console.log('timer!');
}, 100);

// Если poll-фаза была занята 150 мс — callback вызовется через 150+ мс
// setTimeout — это МИНИМАЛЬНАЯ задержка, не точная
```

**Почему setTimeout(fn, 0) ≠ мгновенно?**
- Минимальная задержка в Node.js — 1 мс (в браузере 4 мс после 5 вложенных)
- Callback попадёт в очередь timers → выполнится только когда Event Loop дойдёт до фазы timers

#### 2. PENDING CALLBACKS

Здесь выполняются callback'и системных операций, которые не вошли в poll. Например:
- Ошибки TCP-соединения (`ECONNREFUSED`)
- Некоторые ответы от DNS

На практике ты не взаимодействуешь с этой фазой напрямую.

#### 3. IDLE, PREPARE

Внутренние дела Node.js. Забудь про эту фазу — она для движка, не для тебя.

#### 4. POLL (★ самая важная)

Здесь проводит бо́льшую часть времени Node.js:

1. **Выполняет callback'и** готовых I/O событий (файл прочитан, данные из сети пришли)
2. **Если очередь пуста**, вычисляет сколько можно подождать и **блокируется** на ожидании
3. **Если есть setImmediate** в очереди — **не ждёт**, сразу переходит в check
4. **Если есть готовые таймеры** — возвращается в timers

Это «интеллектуальная» фаза — она решает, ждать или двигаться дальше.

```javascript
// Когда ты читаешь файл:
import { readFile } from 'node:fs';

readFile('data.json', 'utf-8', (err, data) => {
  // Этот callback вызовется в POLL-фазе,
  // когда ОС сообщит что файл прочитан
  console.log(data);
});
// JS-код продолжает выполняться, не ждёт
```

#### 5. CHECK

Только для `setImmediate()`. Выполняется **сразу после poll**.

```javascript
// setImmediate = "выполни как только poll-фаза завершится"
setImmediate(() => {
  console.log('immediate');
});
```

**setTimeout(fn, 0) vs setImmediate() — классический вопрос:**

```javascript
// В ОСНОВНОМ МОДУЛЕ (top-level) — порядок НЕ гарантирован:
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
// Может быть: timeout → immediate ИЛИ immediate → timeout
// Зависит от скорости подготовки процесса

// ВНУТРИ I/O CALLBACK — setImmediate ВСЕГДА первый:
import { readFile } from 'node:fs';
readFile('any-file', () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});
// ВСЕГДА: immediate → timeout
// Потому что мы уже в poll → следующая фаза check → потом timers
```

🎯 **На собесе:** Этот вопрос задают чтобы проверить, понимаешь ли ты фазы или заучил. Объясни через фазы, не через «один быстрее».

#### 6. CLOSE CALLBACKS

```javascript
const socket = new net.Socket();
socket.on('close', () => {
  // Выполнится здесь, в фазе close callbacks
  console.log('socket closed');
});
socket.destroy();
```

### Microtask Queue и nextTick Queue

**МЕЖДУ КАЖДОЙ ФАЗОЙ** (и даже между callback'ами внутри одной фазы!) Node.js проверяет две специальные очереди:

```
                    Приоритет
                    ─────────
               1. process.nextTick queue  (ВЫСШИЙ)
               2. Promise microtask queue
               3. Текущая фаза Event Loop (НИЗШИЙ)
```

```javascript
// Демонстрация приоритетов
setTimeout(() => {
  console.log('1 — setTimeout callback (timers phase)');

  process.nextTick(() => {
    console.log('2 — nextTick ВНУТРИ setTimeout');
  });

  Promise.resolve().then(() => {
    console.log('3 — Promise ВНУТРИ setTimeout');
  });

  // Даже если есть ещё один таймер готовый к выполнению,
  // СНАЧАЛА выполнятся nextTick и Promise!
}, 0);

setTimeout(() => {
  console.log('4 — второй setTimeout');
}, 0);

// Порядок:
// 1 — setTimeout callback
// 2 — nextTick ВНУТРИ setTimeout (nextTick queue вычищается)
// 3 — Promise ВНУТРИ setTimeout (microtask queue вычищается)
// 4 — второй setTimeout (следующий callback фазы timers)
```

### ⚠ ОПАСНОСТЬ: I/O Starvation

```javascript
// ❌ НИКОГДА так не делай — Event Loop зависнет навсегда
function recursive() {
  process.nextTick(recursive);
}
recursive();
// nextTick queue НИКОГДА не опустеет
// → poll фаза никогда не выполнится
// → сервер не принимает запросы
// → все клиенты висят

// ✅ Если нужна рекурсия — используй setImmediate
function safeRecursive() {
  setImmediate(safeRecursive);
  // setImmediate добавляет в check-фазу
  // → между вызовами Event Loop проходит poll
  // → I/O обрабатывается нормально
}
```

### Полный пример — предскажи порядок

```javascript
console.log('1 — sync');

setTimeout(() => {
  console.log('2 — setTimeout 0');
}, 0);

setTimeout(() => {
  console.log('3 — setTimeout 100');
}, 100);

setImmediate(() => {
  console.log('4 — setImmediate');
});

Promise.resolve().then(() => {
  console.log('5 — Promise.then');

  process.nextTick(() => {
    console.log('6 — nextTick inside Promise');
  });
});

process.nextTick(() => {
  console.log('7 — nextTick');

  Promise.resolve().then(() => {
    console.log('8 — Promise inside nextTick');
  });
});

console.log('9 — sync end');
```

**Ответ и объяснение:**

```
1 — sync                          (синхронный код, Call Stack)
9 — sync end                      (синхронный код, Call Stack)
7 — nextTick                      (nextTick queue — высший приоритет)
8 — Promise inside nextTick       (microtask queue — после nextTick)
5 — Promise.then                  (microtask queue)
6 — nextTick inside Promise       (nextTick queue — опять приоритетнее)
2 — setTimeout 0                  (timers phase)
4 — setImmediate                  (check phase)
... 100 мс проходит ...
3 — setTimeout 100                (timers phase, следующий tick)
```

**Логика:**
1. Весь синхронный код выполняется первым (Call Stack)
2. Стек пуст → проверяем nextTick queue → `7`
3. Внутри 7 создалась Promise → в microtask queue → `8`
4. Проверяем microtask queue → `5`
5. Внутри 5 создался nextTick → nextTick queue → `6`
6. Теперь обе очереди пусты → начинаем фазы Event Loop
7. Timers: `2` (setTimeout 0 готов)
8. Poll: ничего
9. Check: `4` (setImmediate)
10. Через 100 мс: `3`

---

## 3. Call Stack, Heap, очереди

### Call Stack (стек вызовов)

**LIFO** (Last In, First Out) — последний вошёл, первый вышел.

```javascript
function multiply(a, b) {
  return a * b;        // 3. Выполняется, убирается из стека
}

function square(n) {
  return multiply(n, n); // 2. Вызывает multiply, добавляет в стек
}

function calculate() {
  const result = square(5); // 1. Вызывает square, добавляет в стек
  console.log(result);      // 4. После возврата square
}

calculate(); // 0. Добавляется в стек
```

```
Состояние Call Stack по шагам:

Шаг 0: [calculate]
Шаг 1: [calculate, square]
Шаг 2: [calculate, square, multiply]
Шаг 3: [calculate, square]  ← multiply вернула 25
Шаг 4: [calculate]          ← square вернула 25
Шаг 5: [calculate, console.log]
Шаг 6: []                   ← стек пуст, Event Loop может работать
```

**Критичное правило:** пока Call Stack НЕ пуст — Event Loop **заблокирован**. Никакие callback'и, Promise, таймеры не выполнятся.

```javascript
// ❌ Блокировка Event Loop тяжёлым вычислением
function heavyComputation() {
  let sum = 0;
  for (let i = 0; i < 1_000_000_000; i++) {
    sum += i;
  }
  return sum;
}

// Этот вызов заблокирует ВЕСЬ сервер на ~1 секунду
// Все клиенты будут ждать
const result = heavyComputation();
```

🔗 **Аналогия:** На фронте ты знаешь, что тяжёлый `for` в обработчике клика замораживает UI. На сервере — замораживает ВСЕ клиентские запросы. Только хуже, потому что затронуты все пользователи, не один.

### Heap (куча)

Куча — неструктурированная область памяти, где хранятся объекты, массивы, замыкания.

```javascript
// Все эти данные живут в Heap:
const user = { name: 'Dzmitry', role: 'dev' };  // объект в Heap
const users = [user];                             // массив в Heap
const handler = () => user.name;                  // замыкание в Heap

// В Call Stack хранятся только ссылки (указатели) на эти объекты
```

V8 Garbage Collector периодически очищает Heap от объектов, на которые нет ссылок. Два поколения:
- **Young Generation** (маленький, частая сборка) — новые объекты
- **Old Generation** (большой, редкая сборка) — объекты которые пережили несколько сборок

Тебе не нужно управлять памятью вручную, но нужно:
1. Не создавать утечек (глобальные массивы, растущие без лимита)
2. Уметь диагностировать через `process.memoryUsage()`

### Очереди задач — сводная таблица

| Очередь | Что туда попадает | Когда выполняется | Приоритет |
|---|---|---|---|
| **Call Stack** | Синхронный код | Сразу | Наивысший |
| **nextTick Queue** | `process.nextTick(fn)` | После текущей операции, ДО microtask | Очень высокий |
| **Microtask Queue** | `Promise.then/catch/finally`, `queueMicrotask(fn)` | После nextTick, ДО макро-задач | Высокий |
| **Macrotask Queues** | `setTimeout`, `setInterval`, I/O callbacks, `setImmediate` | В соответствующих фазах Event Loop | Обычный |

---

## 4. Async/Await и Promise

### ⏭ Что ты уже знаешь (не повторяем)

- Синтаксис async/await — ты пишешь его 3 года
- `Promise.all`, `Promise.race`, `Promise.allSettled` — знаешь
- try/catch внутри async — знаешь
- Callback hell как проблему — знаешь

### Что нужно понять на уровне бэкенда

#### Как async/await работает ПОД КАПОТОМ

```javascript
// Это:
async function getUser(id) {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  const workspace = await db.query('SELECT * FROM workspaces WHERE owner_id = $1', [id]);
  return { user, workspace };
}

// Под капотом превращается примерно в это:
function getUser(id) {
  return db.query('SELECT * FROM users WHERE id = $1', [id])
    .then(user => {
      return db.query('SELECT * FROM workspaces WHERE owner_id = $1', [id])
        .then(workspace => {
          return { user, workspace };
        });
    });
}
```

**Ключевой момент:** `await` — это НЕ блокировка. Он **приостанавливает** выполнение этой функции и **освобождает** Call Stack. Event Loop продолжает обрабатывать другие запросы. Когда Promise разрешается — функция возобновляется из microtask queue.

```javascript
async function handleRequest1() {
  console.log('Request 1: start');
  const data = await readFile('big-file.json', 'utf-8'); // ← освобождает стек!
  console.log('Request 1: got data');
  return data;
}

async function handleRequest2() {
  console.log('Request 2: start');
  return { status: 'ok' };
}

// Если оба вызвать "одновременно":
handleRequest1();
handleRequest2();

// Порядок:
// "Request 1: start"    ← sync часть до await
// "Request 2: start"    ← await освободил стек, взялся request 2!
// "Request 2: finish"
// "Request 1: got data" ← файл прочитался, продолжаем
```

#### Параллельность vs последовательность

```javascript
// ❌ ПОСЛЕДОВАТЕЛЬНО — 2 запроса один за другим
async function slow() {
  const users = await db.query('SELECT * FROM users');      // 50 мс
  const workspaces = await db.query('SELECT * FROM workspaces'); // 50 мс
  // Итого: 100 мс
  return { users, workspaces };
}

// ✅ ПАРАЛЛЕЛЬНО — оба запроса одновременно
async function fast() {
  const [users, workspaces] = await Promise.all([
    db.query('SELECT * FROM users'),       // 50 мс ─┐
    db.query('SELECT * FROM workspaces'),  // 50 мс ─┤ параллельно
  ]);                                      // Итого: 50 мс
  return { users, workspaces };
}
```

🎯 **На собесе:** «Как ускорить несколько независимых async-операций?» — `Promise.all`. Если один может упасть а остальные нужны — `Promise.allSettled`.

#### Обработка ошибок на бэкенде — не как на фронте

На фронте ты мог игнорировать ошибки — пользователь увидит белый экран и перезагрузит. На бэкенде **необработанная ошибка = падение процесса = все клиенты отвалились**.

```javascript
// ❌ Ошибка промиса без catch — unhandled rejection
// В Node.js 15+ это КРАШИТ процесс (process.exit(1))
async function dangerous() {
  const data = await fetch('https://api-that-is-down.com/data');
  return data.json();
}
dangerous(); // Если fetch бросит — процесс упадёт

// ✅ Всегда обрабатывай ошибки
async function safe() {
  try {
    const data = await fetch('https://api-that-is-down.com/data');
    return data.json();
  } catch (error) {
    // Логируем, возвращаем fallback, пробрасываем дальше — но НЕ молчим
    console.error('API call failed:', error.message);
    throw new Error('External service unavailable');
  }
}
```

**Правило для Omnia:** каждый `await` на внешний ресурс (БД, HTTP, файл) — обёрнут в try/catch или обработан .catch().

#### Полезные паттерны для бэкенда

```javascript
// 1. Retry с backoff — критичен для работы с базами и API
async function withRetry(fn, retries = 3, delay = 100) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.warn(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff: 100 → 200 → 400
    }
  }
}

// Использование:
const user = await withRetry(() => db.query('SELECT * FROM users WHERE id = $1', [id]));

// 2. Timeout — не ждать вечно
async function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// Запрос к внешнему API с таймаутом 5 секунд
const data = await withTimeout(fetch('https://api.openai.com/...'), 5000);

// 3. Promise.allSettled — когда нужны результаты ВСЕХ, даже упавших
const results = await Promise.allSettled([
  sendEmail(user.email),
  sendPush(user.deviceToken),
  logToAudit(action),
]);
// results: [
//   { status: 'fulfilled', value: ... },
//   { status: 'rejected', reason: Error },
//   { status: 'fulfilled', value: ... },
// ]
```

---

## 5. Buffers

### Что такое Buffer

Buffer — это контейнер для **бинарных данных** (сырые байты). В браузере ты работал с текстом и JSON. На сервере ты работаешь с байтами: файлы, сетевые пакеты, изображения, шифрование.

```javascript
// Buffer — это последовательность байтов фиксированной длины
// Хранится ВНЕ V8 Heap — в нативной памяти C++

// Создание из строки
const buf1 = Buffer.from('Hello');
console.log(buf1);        // <Buffer 48 65 6c 6c 6f>
//                                  H  e  l  l  o  (ASCII коды в hex)
console.log(buf1.length);  // 5 (байт)

// Создание из строки UTF-8 (кириллица = 2 байта на символ!)
const buf2 = Buffer.from('Привет');
console.log(buf2.length);  // 12 (НЕ 6!)
console.log('Привет'.length); // 6 (JS считает символы, не байты)
// Это КРИТИЧНАЯ разница при работе с Content-Length!

// Пустой буфер заданного размера
const buf3 = Buffer.alloc(10);     // 10 нулевых байт, безопасный
const buf4 = Buffer.allocUnsafe(10); // 10 байт, может содержать мусор из памяти
// allocUnsafe быстрее, но ОПАСЕН — можно слить чужие данные!
// Используй alloc() если заполняешь не сразу
```

### Операции с Buffer

```javascript
const buf = Buffer.from('Hello, Omnia!');

// Чтение
console.log(buf.toString('utf-8'));         // 'Hello, Omnia!'
console.log(buf.toString('utf-8', 0, 5));   // 'Hello' (slice по байтам)
console.log(buf.toString('hex'));            // '48656c6c6f2c204f6d6e696121'
console.log(buf.toString('base64'));         // 'SGVsbG8sIE9tbmlhIQ=='

// Конкатенация
const part1 = Buffer.from('Hello ');
const part2 = Buffer.from('World');
const combined = Buffer.concat([part1, part2]);
console.log(combined.toString()); // 'Hello World'

// Сравнение
const a = Buffer.from('abc');
const b = Buffer.from('abc');
console.log(a.equals(b));    // true  (по содержимому)
console.log(a === b);        // false (разные объекты!)

// Копирование
const source = Buffer.from('Hello');
const target = Buffer.alloc(3);
source.copy(target, 0, 0, 3);  // копируем первые 3 байта
console.log(target.toString()); // 'Hel'
```

### Где Buffer используется в реальном коде

```javascript
// 1. В HTTP-запросах (ты это уже видел в tcp-server!)
// req.on('data') приходит как Buffer:
import { createServer } from 'node:http';

createServer((req, res) => {
  const chunks = [];  // массив Buffer'ов

  req.on('data', (chunk) => {
    // chunk — это Buffer, НЕ строка!
    chunks.push(chunk);
  });

  req.on('end', () => {
    // Собираем все куски в один Buffer, потом в строку
    const body = Buffer.concat(chunks).toString('utf-8');
    const json = JSON.parse(body);
  });
});

// 2. Content-Length ОБЯЗАТЕЛЬНО считать через Buffer
const body = JSON.stringify({ name: 'Дмитрий' });
// ❌ body.length = 21 (символы JS)
// ✅ Buffer.byteLength(body) = 27 (UTF-8 байты, кириллица по 2)
// Если послать неправильный Content-Length — клиент обрежет или повиснет
res.setHeader('Content-Length', Buffer.byteLength(body));

// 3. Хеширование (crypto)
import { createHash } from 'node:crypto';
const hash = createHash('sha256')
  .update(Buffer.from('password123'))
  .digest('hex');
// '... 64 hex символа ...'
```

🎯 **На собесе:** «Что такое Buffer? Зачем он нужен, если есть string?» — Buffer работает с бинарными данными (сырыми байтами), string — с Unicode-текстом. Buffer живёт вне V8 heap. Нужен для I/O: сеть, файлы, crypto. Content-Length считается в байтах (Buffer.byteLength), не в символах (string.length).

---

## 6. Streams

### Концепция

Представь: нужно перелить воду из бочки в 1000 литров в другую. Два варианта:
1. **readFile** — поднять всю бочку целиком и перенести. Нужны руки на 1000 л.
2. **Stream** — подключить шланг. Вода течёт по кусочкам. Нужны руки на 1 ведро.

```
readFile('file.csv') — загружает ВЕСЬ файл в память:

  Файл (500 MB)         RAM
  ┌──────────┐    ┌──────────────┐
  │██████████│ →→ │██████████████│  500 MB в памяти!
  └──────────┘    └──────────────┘

createReadStream('file.csv') — читает по кусочкам:

  Файл (500 MB)         RAM
  ┌──────────┐    ┌────┐
  │██████████│ →  │████│  ~64 KB в памяти (highWaterMark)
  └──────────┘    └────┘
                  обработал → освободил → следующий кусок
```

### 4 типа стримов

```javascript
import { Readable, Writable, Transform, Duplex } from 'node:stream';

// 1. READABLE — источник данных (из него читают)
// Примеры: fs.createReadStream, http request (req), process.stdin
//
// События: 'data', 'end', 'error', 'close'
// Методы: .read(), .pipe(), .destroy()

// 2. WRITABLE — приёмник данных (в него пишут)
// Примеры: fs.createWriteStream, http response (res), process.stdout
//
// События: 'drain', 'finish', 'error', 'close'
// Методы: .write(), .end(), .destroy()

// 3. TRANSFORM — читает, преобразует, отдаёт
// Примеры: zlib.createGzip(), crypto.createCipher()
//
// Принимает данные → модифицирует → передаёт дальше

// 4. DUPLEX — и читает и пишет (независимо)
// Примеры: net.Socket (твой tcp-server!), WebSocket
//
// Два канала: чтение и запись не связаны
```

### Readable Stream подробно

```javascript
import { createReadStream } from 'node:fs';

// Режим 1: Event-based (flowing mode)
const stream = createReadStream('data.csv', {
  encoding: 'utf-8',         // по умолчанию null (Buffer)
  highWaterMark: 64 * 1024,  // размер чанка: 64 KB (по умолчанию)
});

stream.on('data', (chunk) => {
  // chunk приходит каждый раз когда готова порция
  console.log(`Got ${chunk.length} bytes`);
});

stream.on('end', () => {
  console.log('Файл полностью прочитан');
});

stream.on('error', (err) => {
  console.error('Ошибка чтения:', err.message);
});

// Режим 2: for-await (рекомендуемый — чище и проще)
const stream2 = createReadStream('data.csv', { encoding: 'utf-8' });

for await (const chunk of stream2) {
  console.log(`Got ${chunk.length} bytes`);
  // Автоматически обрабатывает backpressure!
}
console.log('Файл полностью прочитан');
```

### Writable Stream подробно

```javascript
import { createWriteStream } from 'node:fs';

const writer = createWriteStream('output.log', { encoding: 'utf-8' });

// .write() возвращает boolean:
// true  = можно писать ещё
// false = внутренний буфер полон, ПОДОЖДИ (backpressure!)

for (let i = 0; i < 1_000_000; i++) {
  const canContinue = writer.write(`Line ${i}\n`);

  if (!canContinue) {
    // Буфер полон — ждём события 'drain'
    await new Promise(resolve => writer.once('drain', resolve));
  }
}

writer.end(); // Сигнал: больше данных не будет
writer.on('finish', () => console.log('Всё записано'));
```

### Backpressure — критичный концепт

**Backpressure** — это когда источник данных (Readable) производит данные быстрее, чем приёмник (Writable) может их обработать.

```
Без backpressure:
  Readable (SSD, 500 MB/s) → → → → → Writable (сеть, 10 MB/s)
                                      ↑ буфер растёт бесконечно = OOM!

С backpressure:
  Readable (пауза) ──────── → → Writable (сеть, 10 MB/s)
                  ↑ "подожди!"   ↑ "готов, давай ещё"
```

`pipeline` автоматически управляет backpressure. `.pipe()` тоже, но хуже обрабатывает ошибки.

### Transform Stream — пример

```javascript
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';

// Transform-стрим, который переводит текст в верхний регистр
const upperCase = new Transform({
  transform(chunk, encoding, callback) {
    // chunk — Buffer или string (зависит от encoding)
    const upper = chunk.toString().toUpperCase();
    callback(null, upper);
    // первый аргумент — ошибка (null = ok)
    // второй — трансформированные данные
  }
});

// Цепочка: файл → uppercase → новый файл
await pipeline(
  createReadStream('input.txt'),
  upperCase,
  createWriteStream('OUTPUT.txt')
);
console.log('Done!');
```

### pipeline vs pipe — почему pipeline

```javascript
import { pipeline } from 'node:stream/promises';

// ❌ .pipe() — LEGACY, не используй в новом коде
readStream
  .pipe(transform)
  .pipe(writeStream);
// Проблемы:
// 1. Если transform бросит ошибку — readStream продолжит лить данные
// 2. writeStream может не закрыться → утечка file descriptor
// 3. Нет нормального способа поймать ошибку

// ✅ pipeline — правильный способ
try {
  await pipeline(readStream, transform, writeStream);
  console.log('Success');
} catch (error) {
  console.error('Pipeline failed:', error.message);
  // Все стримы автоматически закрыты и очищены
}
```

### Реальный пример для Omnia

```javascript
// Пользователь загружает CSV с контактами (может быть 100 MB)
// Нужно: прочитать, распарсить, записать в базу батчами

import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createReadStream } from 'node:fs';

// Transform: собирает строки в батчи по 100
class BatchTransform extends Transform {
  constructor() {
    super({ objectMode: true }); // objectMode: чанки = JS-объекты, не Buffer
    this.batch = [];
  }

  _transform(record, encoding, callback) {
    this.batch.push(record);
    if (this.batch.length >= 100) {
      this.push(this.batch);  // отправляем батч дальше
      this.batch = [];
    }
    callback();
  }

  _flush(callback) {
    // Вызывается когда входящие данные закончились
    if (this.batch.length > 0) {
      this.push(this.batch); // отправляем остаток
    }
    callback();
  }
}

// Writable: пишет батч в базу
class DbWriter extends Writable {
  constructor(db) {
    super({ objectMode: true });
    this.db = db;
  }

  async _write(batch, encoding, callback) {
    try {
      await this.db.batchInsert('contacts', batch);
      callback();
    } catch (error) {
      callback(error); // pipeline поймает
    }
  }
}
```

---

## 7. File System

### Три API — и когда какое

```javascript
// 1. Синхронное API — БЛОКИРУЕТ Event Loop
import { readFileSync, writeFileSync } from 'node:fs';
const data = readFileSync('config.json', 'utf-8'); // Весь процесс стоит!

// ✅ ДОПУСТИМО ТОЛЬКО: при старте приложения (до server.listen())
// ❌ ЗАПРЕЩЕНО: внутри обработчика запросов

// 2. Callback API — старый стиль
import { readFile } from 'node:fs';
readFile('config.json', 'utf-8', (err, data) => {
  if (err) throw err;
  console.log(data);
});

// 3. Promise API — ✅ ИСПОЛЬЗУЙ ЭТО
import { readFile, writeFile, readdir, stat, mkdir, rm, rename } from 'node:fs/promises';
const data2 = await readFile('config.json', 'utf-8');
```

### Основные операции

```javascript
import {
  readFile, writeFile, appendFile,
  readdir, stat, mkdir, rm, rename,
  access, constants
} from 'node:fs/promises';
import { join } from 'node:path';

// ── ЧТЕНИЕ ─────────────────────────────────────────

// Чтение файла целиком (для маленьких файлов < 10 MB)
const config = JSON.parse(
  await readFile('config.json', 'utf-8')
);

// Чтение без encoding → получаем Buffer
const imageBuffer = await readFile('avatar.png');
console.log(imageBuffer.length); // размер в байтах

// ── ЗАПИСЬ ──────────────────────────────────────────

// Записать файл (перезаписывает!)
await writeFile('output.json', JSON.stringify(data, null, 2), 'utf-8');

// Дописать в конец файла
await appendFile('app.log', `[${new Date().toISOString()}] Server started\n`);

// ── ДИРЕКТОРИИ ─────────────────────────────────────

// Создать директорию (recursive: true = аналог mkdir -p)
await mkdir('uploads/avatars/thumbnails', { recursive: true });

// Прочитать содержимое директории
const files = await readdir('uploads');
console.log(files); // ['avatar1.png', 'avatar2.png', 'docs']

// С типами (файл или директория?)
const entries = await readdir('uploads', { withFileTypes: true });
for (const entry of entries) {
  console.log(`${entry.name}: ${entry.isFile() ? 'file' : 'directory'}`);
}

// ── ИНФОРМАЦИЯ О ФАЙЛЕ ─────────────────────────────

const info = await stat('package.json');
console.log({
  size: info.size,              // размер в байтах
  isFile: info.isFile(),        // true
  isDirectory: info.isDirectory(), // false
  created: info.birthtime,      // дата создания
  modified: info.mtime,         // дата изменения
});

// ── ПРОВЕРКА СУЩЕСТВОВАНИЯ ─────────────────────────

// ❌ НЕ используй existsSync/exists — race condition!
// Файл может быть удалён между проверкой и чтением

// ✅ Просто читай и обрабатывай ошибку:
try {
  const data = await readFile('maybe-exists.json', 'utf-8');
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('Файл не найден');
  } else {
    throw error; // другая ошибка — пробрасываем
  }
}

// Или если реально нужно только проверить (без чтения):
try {
  await access('file.txt', constants.R_OK);
  console.log('Файл существует и доступен для чтения');
} catch {
  console.log('Файл недоступен');
}

// ── УДАЛЕНИЕ ───────────────────────────────────────

// Удалить файл
await rm('temp.txt');

// Удалить директорию с содержимым
await rm('temp-folder', { recursive: true, force: true });

// ── ПЕРЕИМЕНОВАНИЕ / ПЕРЕМЕЩЕНИЕ ───────────────────

await rename('old-name.txt', 'new-name.txt');
await rename('file.txt', 'archive/file.txt'); // перемещение
```

### readFile vs createReadStream — когда что

```javascript
import { readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';

// ┌──────────────────────────────────────────────────────────┐
// │                    ПРАВИЛО                               │
// │                                                          │
// │  Файл < 10 MB  →  readFile (проще, весь файл в памяти)  │
// │  Файл > 10 MB  →  createReadStream (поток, экономит RAM) │
// │  Неизвестный размер → createReadStream (безопасно)        │
// └──────────────────────────────────────────────────────────┘

// readFile для конфига (2 KB)
const config = JSON.parse(await readFile('config.json', 'utf-8'));

// createReadStream для лога (2 GB)
let lineCount = 0;
const stream = createReadStream('access.log', { encoding: 'utf-8' });
for await (const chunk of stream) {
  lineCount += chunk.split('\n').length - 1;
}
console.log(`Lines: ${lineCount}`);
// Потребление RAM: ~64 KB вместо 2 GB!
```

### Коды ошибок fs — нужно знать

| Код | Что значит | Когда |
|---|---|---|
| `ENOENT` | No such file or directory | readFile несуществующего файла |
| `EACCES` | Permission denied | Нет прав на чтение/запись |
| `EISDIR` | Is a directory | readFile на директорию |
| `EEXIST` | File already exists | mkdir без recursive |
| `EMFILE` | Too many open files | Открыли слишком много файлов одновременно |
| `ENOSPC` | No space left on device | Диск заполнен |

```javascript
try {
  await readFile('/etc/shadow', 'utf-8');
} catch (error) {
  switch (error.code) {
    case 'ENOENT':  console.log('Файл не найден'); break;
    case 'EACCES':  console.log('Нет доступа'); break;
    default:        throw error;
  }
}
```

---

## 8. Path, OS, Process

### Path — работа с путями

```javascript
import { join, resolve, basename, dirname, extname, parse, relative, sep } from 'node:path';

// join — склеивает части пути через разделитель ОС
join('uploads', 'avatars', 'user-123.png');
// macOS/Linux: 'uploads/avatars/user-123.png'
// Windows:     'uploads\\avatars\\user-123.png'

// ❌ НИКОГДА не конкатенируй строки для путей:
// 'uploads/' + userInput  ← Path Traversal Attack!
// Если userInput = '../../etc/passwd' → читаешь системный файл

// ✅ Безопасная работа с пользовательским вводом:
const safePath = join('uploads', basename(userInput));
// basename('../../etc/passwd') → 'passwd'
// Отсекает все ../ — остаётся только имя файла

// resolve — абсолютный путь от текущей директории
resolve('config.json');
// → '/Users/dzmitry/Desktop/projects/roadmap-backend/config.json'

resolve('/tmp', 'uploads', 'file.txt');
// → '/tmp/uploads/file.txt' (если начинается с / — берёт как корень)

// Разбор пути
const info = parse('/Users/dzmitry/projects/app/server.ts');
// {
//   root: '/',
//   dir: '/Users/dzmitry/projects/app',
//   base: 'server.ts',
//   name: 'server',
//   ext: '.ts'
// }

basename('/path/to/file.txt');  // 'file.txt'
dirname('/path/to/file.txt');   // '/path/to'
extname('/path/to/file.txt');   // '.txt'
extname('Makefile');             // '' (нет расширения)

// relative — относительный путь между двумя абсолютными
relative('/Users/dzmitry/projects', '/Users/dzmitry/projects/app/server.ts');
// → 'app/server.ts'

// sep — разделитель пути текущей ОС
console.log(sep); // '/' на macOS/Linux, '\\' на Windows
```

### OS — информация о системе

```javascript
import { cpus, totalmem, freemem, platform, hostname, homedir, tmpdir, uptime } from 'node:os';

// Полезно для health check endpoint, диагностики, логирования

console.log(`Platform: ${platform()}`);       // 'darwin' (macOS), 'linux', 'win32'
console.log(`Hostname: ${hostname()}`);        // имя машины
console.log(`CPUs: ${cpus().length}`);         // количество ядер
console.log(`Architecture: ${process.arch}`);  // 'arm64' (Apple Silicon), 'x64'

// Память
const totalGB = (totalmem() / 1024 ** 3).toFixed(1);
const freeGB = (freemem() / 1024 ** 3).toFixed(1);
console.log(`RAM: ${freeGB} / ${totalGB} GB free`);

// Пути
console.log(`Home: ${homedir()}`);   // '/Users/dzmitry'
console.log(`Temp: ${tmpdir()}`);    // '/tmp' или '/var/folders/...'

// Uptime системы
console.log(`System uptime: ${(uptime() / 3600).toFixed(1)} hours`);

// Пример: health check endpoint для Omnia
function getHealthInfo() {
  const mem = process.memoryUsage();
  return {
    status: 'ok',
    uptime: process.uptime(),
    memory: {
      rss: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
      heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,
      heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`,
    },
    system: {
      platform: platform(),
      cpus: cpus().length,
      freeMemory: `${(freemem() / 1024 / 1024).toFixed(0)} MB`,
    },
  };
}
```

### Process — текущий процесс Node.js

```javascript
// process — глобальный объект, доступен везде без import

// ── Переменные окружения ───────────────────────────
console.log(process.env.NODE_ENV);    // 'development', 'production', 'test'
console.log(process.env.DATABASE_URL); // из .env файла
console.log(process.env.PORT);         // '3000' (ВСЕГДА строка!)
const port = parseInt(process.env.PORT, 10) || 3000; // преобразуй в число

// ── Аргументы командной строки ─────────────────────
// node script.js --port 8080 hello
console.log(process.argv);
// [
//   '/usr/local/bin/node',   // [0] путь к node
//   '/path/to/script.js',    // [1] путь к скрипту
//   '--port',                 // [2] твои аргументы
//   '8080',                   // [3]
//   'hello'                   // [4]
// ]

// ── Текущая директория ─────────────────────────────
console.log(process.cwd());  // '/Users/dzmitry/Desktop/projects/roadmap-backend'
// cwd() — откуда запустил, НЕ где лежит файл

// ── PID (идентификатор процесса) ───────────────────
console.log(process.pid);    // 12345
// Нужен для логирования, мониторинга, graceful shutdown

// ── Использование памяти ───────────────────────────
const mem = process.memoryUsage();
console.log({
  rss: mem.rss,            // Resident Set Size — сколько RAM занимает процесс
  heapTotal: mem.heapTotal, // Выделено V8 под heap
  heapUsed: mem.heapUsed,   // Реально используется в heap
  external: mem.external,   // C++ объекты, привязанные к JS (Buffer'ы!)
  arrayBuffers: mem.arrayBuffers, // ArrayBuffer + SharedArrayBuffer
});

// ── Graceful Shutdown (★ важно для продакшена) ─────
// Когда Docker/Kubernetes останавливает контейнер — посылает SIGTERM
// Нужно: закрыть соединения, дождаться запросов, выйти чисто

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');

  // 1. Перестать принимать новые запросы
  server.close();

  // 2. Закрыть соединение с базой
  await db.end();

  // 3. Выйти с кодом 0 (успех)
  process.exit(0);
});

process.on('SIGINT', () => {
  // Ctrl+C в терминале
  console.log('SIGINT received (Ctrl+C)');
  process.exit(0);
});

// ── Необработанные ошибки (последний рубеж) ────────
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  // Залогировать и УМЕРЕТЬ — состояние процесса непредсказуемо
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  // В Node 15+ это крашит процесс автоматически
});

// ── Версии ─────────────────────────────────────────
console.log(process.version);   // 'v22.5.0'
console.log(process.versions);  // { v8: '12.4...', openssl: '3.0...', ... }
```

### process.memoryUsage() — что значат числа

```
┌────────────────────────────────────────────────┐
│                    RSS                         │
│  (Resident Set Size — вся память процесса)     │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │              V8 Heap                     │  │
│  │  ┌─────────────────────────────────┐     │  │
│  │  │         heapUsed               │     │  │
│  │  │  (реально занятые объекты)      │     │  │
│  │  └─────────────────────────────────┘     │  │
│  │  [свободное место = heapTotal-heapUsed]  │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌──────────────────────┐                      │
│  │      external        │  ← Buffer'ы          │
│  │  (C++ объекты)       │  ← нативные модули   │
│  └──────────────────────┘                      │
│                                                │
│  [код, стек, служебное]                        │
└────────────────────────────────────────────────┘
```

---

## Шпаргалка для собеседования (всё в одном месте)

| Вопрос | Короткий ответ | Детали |
|---|---|---|
| Что такое Event Loop? | Цикл, который проверяет очереди задач по фазам: timers→poll→check | 6 фаз, между ними nextTick + microtask |
| Фазы Event Loop? | timers → pending → idle → poll → check → close | poll — основная, check — setImmediate |
| nextTick vs Promise.then? | nextTick приоритетнее, выполняется до microtask | Обе — между фазами |
| setTimeout(0) vs setImmediate? | В I/O callback — setImmediate всегда первый. В top-level — недетерминировано | Потому что setImmediate = check phase (сразу после poll) |
| Что блокирует Event Loop? | Тяжёлые sync-вычисления, readFileSync, crypto sync | Решение: worker threads или разбить на чанки |
| Что такое Buffer? | Контейнер для бинарных данных вне V8 heap | byteLength ≠ string.length для UTF-8 |
| readFile vs createReadStream? | readFile — всё в RAM. Stream — порциями | Stream для файлов > 10 MB |
| Зачем pipeline? | Управляет backpressure + пробрасывает ошибки + закрывает стримы | .pipe() legacy, не обрабатывает ошибки |
| Backpressure? | Readable быстрее Writable → буфер растёт → OOM | pipeline/pipe решает автоматически |
| readFileSync допустим когда? | При старте (до listen). НИКОГДА в обработчике запроса | Блокирует ВСЕ клиентские запросы |

---

## Что дальше

После изучения этих тем → переходи к практике:
1. **HTTP-сервер на node:http** — CRUD /users без фреймворков
2. **Бенчмарк памяти** — readFile vs createReadStream
3. **CLI-скрипт** — чтение JSON через fs/promises
4. **Тест Event Loop** — предсказать порядок выполнения
