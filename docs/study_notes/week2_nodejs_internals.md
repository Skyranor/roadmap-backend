# Неделя 2 · Node.js — движок под капотом

> Полный разбор от нуля до уровня собеседования. Каждая тема с объяснением «зачем» и «как под капотом», а не пересказ документации.

---

## Содержание

1. [Что такое Node.js — и почему это НЕ «JavaScript на сервере»](#1-что-такое-nodejs)
2. [Event Loop — сердце Node.js](#2-event-loop)
3. [Call Stack, Heap, очереди задач](#3-call-stack-heap-очереди-задач)
4. [Async/Await и Promise — бэкенд-специфика](#4-asyncawait-и-promise)
5. [Buffers — бинарные данные](#5-buffers)
6. [Streams — потоковая обработка](#6-streams)
7. [File System (fs) — работа с файлами](#7-file-system)
8. [Path, OS, Process — системные модули](#8-path-os-process)
9. [Шпаргалка для собеседования](#9-шпаргалка-для-собеседования)
10. [Чек-поинт](#10-чек-поинт)

---

## 1. Что такое Node.js

### Суть в 5 предложениях

Node.js — это **рантайм** для JavaScript вне браузера. Внутри — движок **V8** (тот же что в Chrome) + библиотека **libuv** (написана на C), которая даёт доступ к файловой системе, сети, потокам ОС. Node.js **однопоточный** для твоего JS-кода, но **не однопоточный** внутри — libuv использует пул потоков (4 по умолчанию) для блокирующих операций (чтение файлов, DNS, crypto). Это позволяет обрабатывать тысячи одновременных соединений одним процессом.

> **Важно:** Размер пула регулируется переменной окружения `UV_THREADPOOL_SIZE`. Если у тебя тяжёлый I/O или криптография (много хэширования bcrypt), стандартных 4 потоков не хватит — наступит **starvation** (голодание). На проде часто ставят `UV_THREADPOOL_SIZE=16` или по количеству ядер CPU, чтобы узким горлышком не стали эти 4 потока.

### Архитектура — три слоя

Когда ты пишешь `const data = await readFile('config.json')`, происходит следующее:

```
┌─────────────────────────────────────────┐
│         1. Твой JavaScript код          │
│    (V8 компилирует в машинный код)      │
├─────────────────────────────────────────┤
│       2. Node.js Bindings (C++)         │
│  Мост: JS вызывает fs.readFile →       │
│  binding передаёт вызов в libuv        │
├──────────────────┬──────────────────────┤
│       V8         │       libuv          │
│  JIT-компиляция  │  Event Loop,         │
│  JS → машинный   │  async I/O,          │
│  код             │  thread pool         │
├──────────────────┴──────────────────────┤
│           3. Операционная система       │
│     (файлы, сеть, процессы, память)     │
└─────────────────────────────────────────┘
```

**Слой 1 — твой код.** V8 компилирует его в машинный код через JIT (Just-In-Time).

**Слой 2 — Node.js Bindings.** JavaScript не умеет читать файлы с диска. Binding берёт вызов `fs.readFile` и передаёт его в libuv. Это мост между JS-миром и системным уровнем.

**Слой 3 — libuv.** Абстракция над I/O операционной системы. Решает, **как** выполнить операцию: через thread pool (для файловых операций) или через механизмы ОС (для сети).

### Зачем нужна libuv?

Каждая ОС реализует асинхронный I/O по-своему:

| ОС | Механизм | Что делает |
|---|---|---|
| Linux | `epoll` | Следит за событиями на файловых дескрипторах |
| macOS | `kqueue` | Аналог epoll, но с другим API |
| Windows | `IOCP` | I/O Completion Ports — совершенно другая модель |

libuv абстрагирует эти различия. Ты пишешь один код — libuv сама выбирает правильный системный вызов. Все три механизма позволяют следить за тысячами сокетов/файлов одновременно **без** создания потока на каждый.

### V8 и JIT-компиляция

V8 **НЕ интерпретирует** JavaScript. Он компилирует его в машинный код:

1. **Первый проход — быстрая компиляция.** Код быстро компилируется в неоптимизированный машинный код (Ignition → Sparkplug). Работает, но не максимально быстро.

2. **«Горячие» функции.** V8 отслеживает, какие функции вызываются часто. Когда функция «нагревается» — V8 перекомпилирует её с агрессивными оптимизациями (TurboFan): inline-подстановка, удаление мёртвого кода, type specialization.

3. **Деоптимизация.** Если предположения оптимизатора нарушены (например, функция начала получать другой тип аргумента) — V8 делает fallback к неоптимизированному коду и начинает заново.

Именно поэтому Node.js быстрый для серверных задач — это не интерпретация, а **компиляция** в нативный код.

### 🔗 Аналогия из фронтенда

Ты знаешь, что браузер — это не только V8. Есть Web API (DOM, fetch, setTimeout). В Node.js вместо Web API — libuv и встроенные модули (fs, http, net). Тот же принцип: **JS-движок + платформенный слой**. На фронте платформенный слой даёт тебе DOM. На сервере — файловую систему, сеть, процессы ОС.

### 🎯 На собесе

**Q: Что такое Node.js?**

❌ «Это JavaScript на сервере»

✅ «Это рантайм, построенный на движке V8 и библиотеке libuv. V8 JIT-компилирует JavaScript в машинный код. libuv обеспечивает event-driven, non-blocking I/O модель. Благодаря этому один поток JS-кода может обслуживать тысячи одновременных соединений — JS однопоточный, но I/O выполняется асинхронно через механизмы ОС (epoll/kqueue/IOCP) и thread pool libuv для блокирующих операций вроде файлового I/O.»

---

## 2. Event Loop

### Зачем Event Loop существует — проблема, которую он решает

Чтобы понять Event Loop, нужно понять **проблему**.

**Традиционная модель** (Apache, PHP, старая Java):

```
Запрос 1 → Thread 1 → запрос к БД → Thread 1 ЖДЁТ 100 мс → ответ
Запрос 2 → Thread 2 → запрос к БД → Thread 2 ЖДЁТ 100 мс → ответ
...
Запрос 1000 → Thread 1000 → 1000 потоков × ~1 MB стека = 1 GB RAM
```

Проблемы:
- Каждый поток потребляет **~1 MB стека** минимум
- **Context switching** — процессор тратит время, переключаясь между потоками (сохранение/восстановление регистров, TLB flush)
- При 10,000 соединениях (C10K problem) — система захлёбывается

**Модель Node.js:**

```
Запрос 1 → JS отправляет запрос к БД → НЕ ждёт → берёт Запрос 2
Запрос 2 → JS отправляет запрос к файлу → НЕ ждёт → берёт Запрос 3
...
Ответ от БД готов → Event Loop вызывает callback Запроса 1
Файл прочитан → Event Loop вызывает callback Запроса 2
```

**Один поток** обслуживает всё. Нет потерь на context switching. Потребление RAM — в разы меньше.

### Фазы Event Loop

Event Loop — это **бесконечный цикл**, который проверяет очереди задач по порядку. Каждая итерация называется **tick**. В каждом tick — 6 фаз, строго по порядку:

```
   ┌───────────────────────────────────────────────┐
   │                                               │
   │  ┌─────────────────────────────────────────┐  │
   │  │          1. TIMERS                      │  │
   │  │  Callback'и setTimeout / setInterval,   │  │
   │  │  у которых время истекло                │  │
   │  └────────────────┬────────────────────────┘  │
   │                   │                           │
   │  ┌────────────────┴────────────────────────┐  │
   │  │      2. PENDING CALLBACKS               │  │
   │  │  Системные I/O callback'и, отложенные   │  │
   │  │  с прошлого цикла (ошибки TCP и др.)    │  │
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
   │  │  в Check. Если есть таймеры — в Timers. │  │
   │  └────────────────┬────────────────────────┘  │
   │                   │                           │
   │  ┌────────────────┴────────────────────────┐  │
   │  │      5. CHECK                           │  │
   │  │  Callback'и setImmediate()              │  │
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

#### Фаза 1: TIMERS

Выполняет callback'и `setTimeout` и `setInterval`, у которых время истекло.

```typescript
// setTimeout говорит: «вызови меня НЕ РАНЬШЕ чем через N мс»
// Это НЕ гарантия точного времени!
setTimeout(() => {
  console.log('timer!');
}, 100);

// Если poll-фаза была занята 150 мс — callback вызовется через 150+ мс
// setTimeout — это МИНИМАЛЬНАЯ задержка, не точная
```

**Почему `setTimeout(fn, 0)` ≠ мгновенно?**
- Минимальная задержка в Node.js — **1 мс** (в браузере 4 мс после 5 вложенных)
- Callback попадёт в очередь timers → выполнится только когда Event Loop дойдёт до фазы timers
- Сначала выполнится весь синхронный код, потом nextTick queue, потом microtask queue — и только потом timers

#### Фаза 2: PENDING CALLBACKS

Системные callback'и, которые не вошли в poll-фазу предыдущего цикла:
- Ошибки TCP-соединений (`ECONNREFUSED`)
- Некоторые ответы от DNS-резолвера

На практике ты не взаимодействуешь с этой фазой напрямую.

#### Фаза 3: IDLE, PREPARE

Внутренняя кухня libuv. Для движка, не для тебя. Забудь.

#### Фаза 4: POLL (★ самая важная)

Здесь Node.js проводит **бо́льшую часть времени**. Poll — «интеллектуальная» фаза, которая принимает решения:

1. **Выполняет callback'и** готовых I/O-событий (файл прочитан, данные из сети пришли, ответ от БД готов)

2. **Если очередь пуста** — вычисляет, сколько можно подождать, и **блокируется** на ожидании. Node.js не крутит busy loop. Он говорит ОС: «разбуди меня, когда что-то случится или когда истечёт ближайший таймер.»

3. **Если есть `setImmediate`** в очереди — **не ждёт**, сразу переходит в check-фазу

4. **Если есть готовые таймеры** — возвращается в timers

```typescript
// Когда ты читаешь файл:
import { readFile } from 'node:fs';

readFile('data.json', 'utf-8', (err, data) => {
  // Этот callback вызовется в POLL-фазе,
  // когда ОС сообщит что файл прочитан
  console.log(data);
});
// JS-код продолжает выполняться, не ждёт
```

#### Фаза 5: CHECK

Только для `setImmediate()`. Выполняется **сразу после poll**.

```typescript
// setImmediate = «выполни как только poll-фаза завершится»
setImmediate(() => {
  console.log('immediate');
});
```

**`setTimeout(fn, 0)` vs `setImmediate()` — классический вопрос на собесе:**

```typescript
// В ОСНОВНОМ МОДУЛЕ (top-level) — порядок НЕ детерминирован:
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
// Может быть: timeout → immediate ИЛИ immediate → timeout
// Зависит от того, успел ли 1 мс пройти к моменту входа в timers-фазу

// ВНУТРИ I/O CALLBACK — setImmediate ВСЕГДА первый:
import { readFile } from 'node:fs';
readFile('any-file', () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});
// ВСЕГДА: immediate → timeout
// Потому что мы в poll → следующая фаза check → потом timers на следующем обороте
```

🎯 **На собесе:** Этот вопрос задают чтобы проверить — ты понимаешь фазы или заучил. **Объясняй через фазы**, не через «один быстрее»: «Внутри I/O callback мы находимся в poll-фазе. Следующая — check (setImmediate). Timers — только на следующем обороте цикла. Поэтому setImmediate первый. В top-level порядок недетерминирован, потому что зависит от calibration таймера — успел ли 1 мс пройти.»

#### Фаза 6: CLOSE CALLBACKS

```typescript
const socket = new net.Socket();
socket.on('close', () => {
  // Выполнится здесь, в фазе close callbacks
  console.log('socket closed');
});
socket.destroy();
```

### Microtask Queue и nextTick Queue — «вне фаз»

**МЕЖДУ КАЖДОЙ ФАЗОЙ** (и даже **между callback'ами внутри одной фазы!**) Node.js проверяет две специальные очереди:

```
                    Приоритет
                    ─────────
               1. process.nextTick queue  (НАИВЫСШИЙ)
               2. Promise microtask queue
               3. Текущая фаза Event Loop (ОБЫЧНЫЙ)
```

Это значит: если внутри setTimeout-callback ты вызвал `process.nextTick(fn)` и `Promise.resolve().then(fn2)` — оба выполнятся **ДО** следующего setTimeout-callback'а из той же фазы.

**Порядок обработки:**
1. Завершился текущий callback
2. Очищается **ВСЯ** nextTick queue (все nextTick'и, включая те, что были добавлены другими nextTick'ами!)
3. Очищается **ВСЯ** microtask queue (Promise.then/catch/finally)
4. Только потом — следующий callback фазы

```typescript
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

```typescript
// ❌ НИКОГДА так не делай — Event Loop зависнет навсегда
function recursive() {
  process.nextTick(recursive);
}
recursive();
// nextTick queue НИКОГДА не опустеет
// → poll фаза никогда не выполнится
// → сервер не принимает запросы
// → все клиенты висят
// Процесс выглядит живым (PID есть, CPU жрёт), но не обрабатывает ни одного запроса

// ✅ Если нужна рекурсия — используй setImmediate
function safeRecursive() {
  setImmediate(safeRecursive);
  // setImmediate добавляет в check-фазу
  // → между вызовами Event Loop проходит poll
  // → I/O обрабатывается нормально
}
```

### Полный пример — предскажи порядок

```typescript
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

**Ответ и пошаговое объяснение:**

```
1 — sync                          (синхронный код, Call Stack)
9 — sync end                      (синхронный код, Call Stack)
7 — nextTick                      (nextTick queue — наивысший приоритет)
8 — Promise inside nextTick       (microtask queue — после nextTick)
5 — Promise.then                  (microtask queue)
6 — nextTick inside Promise       (nextTick queue — опять приоритетнее)
2 — setTimeout 0                  (timers phase)
4 — setImmediate                  (check phase)
... 100 мс проходит ...
3 — setTimeout 100                (timers phase, следующий tick)
```

**Логика:**
1. Весь синхронный код выполняется первым (Call Stack): `1`, `9`
2. Стек пуст → проверяем nextTick queue → `7`
3. Внутри `7` создалась Promise → в microtask queue → `8`
4. Проверяем microtask queue → `5`
5. Внутри `5` создался nextTick → nextTick queue → `6` (nextTick приоритетнее оставшихся microtask)
6. Теперь обе очереди пусты → начинаем фазы Event Loop
7. Timers: `2` (setTimeout 0 готов)
8. Poll: ничего
9. Check: `4` (setImmediate)
10. Через 100 мс: `3`

---

## 3. Call Stack, Heap, очереди задач

### Call Stack — стек вызовов

**LIFO** (Last In, First Out) — последний вошёл, первый вышел. Когда вызываешь функцию — она добавляется на вершину стека. Когда возвращается — удаляется.

```typescript
function multiply(a: number, b: number) {
  return a * b;          // 3. Выполняется, убирается из стека
}

function square(n: number) {
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

**🔴 Критичное правило:** пока Call Stack **НЕ пуст** — Event Loop **заблокирован**. Ни один callback, Promise, таймер — ничего не выполнится.

```typescript
// ❌ Блокировка Event Loop тяжёлым вычислением
function heavyComputation() {
  let sum = 0;
  for (let i = 0; i < 1_000_000_000; i++) {
    sum += i;
  }
  return sum;
}

// Этот вызов заблокирует ВЕСЬ сервер на ~1 секунду
// ВСЕ клиенты будут ждать — не один, а ВСЕ
const result = heavyComputation();
```

🔗 **Аналогия:** На фронте тяжёлый `for` в обработчике клика замораживает UI — кнопки не нажимаются, анимации стоят. На сервере — **хуже**. Заморожены ВСЕ пользователи, не один. 1000 клиентов ждут, пока один запрос считает.

**Решения для тяжёлых вычислений** (знать что есть, руками сейчас не трогаем):
- `worker_threads` — выносят вычисление в отдельный поток
- Разбиение на чанки через `setImmediate` — даёшь Event Loop «подышать» между итерациями

### Heap — область памяти для объектов

Неструктурированная область памяти, где хранятся все объекты, массивы, замыкания. В Call Stack — только **ссылки** (указатели) на них.

```typescript
// Все эти данные живут в Heap:
const user = { name: 'Dzmitry', role: 'dev' };  // объект в Heap
const users = [user];                             // массив в Heap
const handler = () => user.name;                  // замыкание в Heap

// В Call Stack хранятся только ссылки на эти объекты
```

**V8 Garbage Collector** периодически очищает Heap от «мёртвых» объектов (на которые никто не ссылается). Два поколения:

- **Young Generation** (Scavenge) — маленькая область, собирается часто. Новые объекты попадают сюда. Алгоритм быстрый, но копирует живые объекты → эффективен когда мало живых, много мусора.

- **Old Generation** (Mark-Sweep-Compact) — большая область, собирается реже. Объекты, пережившие несколько сборок Young Generation, «промоутятся» сюда. Алгоритм медленнее, но обрабатывает большие объёмы.

Тебе **не нужно управлять памятью** вручную, но нужно:
1. **Не создавать утечек** — глобальные массивы, растущие без лимита; забытые event listener'ы; замыкания, держащие ссылки на большие объекты
2. **Уметь диагностировать** — `process.memoryUsage()`: если `heapUsed` растёт монотонно и не снижается после GC — утечка

### Очереди задач — сводная таблица

| Очередь | Что туда попадает | Когда выполняется | Приоритет |
|---|---|---|---|
| **Call Stack** | Синхронный код | Сразу | Наивысший |
| **nextTick Queue** | `process.nextTick(fn)` | После текущей операции, ДО microtask | Очень высокий |
| **Microtask Queue** | `Promise.then/catch/finally`, `queueMicrotask(fn)` | После nextTick, ДО фаз Event Loop | Высокий |
| **Macrotask Queues** | `setTimeout`, `setInterval`, I/O callbacks, `setImmediate` | В соответствующих фазах Event Loop | Обычный |

---

## 4. Async/Await и Promise

### ⏭ Что ты уже знаешь (не повторяем)

- Синтаксис async/await — ты пишешь его 3 года
- `Promise.all`, `Promise.race`, `Promise.allSettled` — знаешь
- try/catch внутри async — знаешь
- Callback hell как проблему — знаешь

### Как async/await работает ПОД КАПОТОМ

```typescript
// Это:
async function getUser(id: string) {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  const workspace = await db.query('SELECT * FROM workspaces WHERE owner_id = $1', [id]);
  return { user, workspace };
}

// Под капотом превращается примерно в это:
function getUser(id: string) {
  return db.query('SELECT * FROM users WHERE id = $1', [id])
    .then(user => {
      return db.query('SELECT * FROM workspaces WHERE owner_id = $1', [id])
        .then(workspace => {
          return { user, workspace };
        });
    });
}
```

**Что именно делает `await`:**

1. Вызывает `db.query(...)` — получает Promise
2. **Приостанавливает** выполнение `getUser` — вся функция «замораживается»
3. **Освобождает Call Stack** — Event Loop свободен обрабатывать другие запросы!
4. Когда Promise разрешается — функция **возобновляется** из microtask queue
5. Результат присваивается переменной

**Ключевой момент:** `await` — это **НЕ блокировка**. Это **пауза конкретной функции** с освобождением потока. Другие запросы обрабатываются пока эта функция ждёт.

```typescript
async function handleRequest1() {
  console.log('Request 1: start');
  const data = await readFile('big-file.json', 'utf-8'); // ← пауза, стек свободен!
  console.log('Request 1: got data');
  return data;
}

async function handleRequest2() {
  console.log('Request 2: start');
  return { status: 'ok' };
}

// Если оба вызвать «одновременно»:
handleRequest1();
handleRequest2();

// Порядок:
// «Request 1: start»    ← sync часть до await
// «Request 2: start»    ← await R1 освободил стек, Node взялся за R2!
// «Request 2: finish»
// «Request 1: got data» ← файл прочитался, R1 продолжился
```

### Параллельность vs последовательность

```typescript
// ❌ ПОСЛЕДОВАТЕЛЬНО — 2 запроса один за другим
async function slow() {
  const users = await db.query('SELECT * FROM users');         // 50 мс
  const workspaces = await db.query('SELECT * FROM workspaces'); // 50 мс
  // Итого: 100 мс — второй запрос ЖДЁТ первый
  return { users, workspaces };
}

// ✅ ПАРАЛЛЕЛЬНО — оба запроса одновременно
async function fast() {
  const [users, workspaces] = await Promise.all([
    db.query('SELECT * FROM users'),        // 50 мс ─┐
    db.query('SELECT * FROM workspaces'),   // 50 мс ─┤ параллельно
  ]);                                        // Итого: ~50 мс
  return { users, workspaces };
}
```

🎯 **На собесе:** «Как ускорить несколько независимых async-операций?» → `Promise.all`. «А если один может упасть, а остальные нужны?» → `Promise.allSettled` — вернёт массив `{status: 'fulfilled'|'rejected', value|reason}`.

### Обработка ошибок — бэкенд ≠ фронтенд

На фронте: ошибка → пользователь видит белый экран → перезагружает. Неприятно, но затронут один человек.

На бэкенде: **необработанная ошибка = крах процесса = ВСЕ клиенты отключены**.

```typescript
// ❌ Ошибка промиса без catch — unhandled rejection
// В Node.js 15+ это КРАШИТ процесс (process.exit(1))
async function dangerous() {
  const data = await fetch('https://api-that-is-down.com/data');
  return data.json();
}
dangerous(); // Если fetch бросит — ПРОЦЕСС УМРЁТ

// ✅ Всегда обрабатывай ошибки
async function safe() {
  try {
    const data = await fetch('https://api-that-is-down.com/data');
    return data.json();
  } catch (error) {
    // Логируем, возвращаем fallback, пробрасываем — но НЕ молчим
    console.error('API call failed:', error.message);
    throw new Error('External service unavailable');
  }
}
```

**Правило для Omnia:** каждый `await` на внешний ресурс (БД, HTTP, файл) — обёрнут в try/catch или обработан .catch().

### Паттерны для бэкенда

#### 1. Retry с exponential backoff

Сеть ненадёжна. БД может быть временно перегружена. Один retry с backoff спасает от кучи 500-ошибок. Backoff нужен, чтобы не забивать перегруженный сервис ещё больше.

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 100,
): Promise<T> {
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
  throw new Error('Unreachable');
}

// Использование:
const user = await withRetry(() =>
  db.query('SELECT * FROM users WHERE id = $1', [id])
);
```

#### 2. Timeout — не ждать вечно

Внешний API завис — дефолтный таймаут может быть 30+ секунд. Лучше упасть за 5 секунд и вернуть 503, чем держать соединение и потреблять ресурсы.

```typescript
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// Запрос к внешнему API с таймаутом 5 секунд
const data = await withTimeout(fetch('https://api.openai.com/...'), 5000);
```

#### 3. Promise.allSettled — когда нужны результаты ВСЕХ, даже упавших

```typescript
const results = await Promise.allSettled([
  sendEmail(user.email),
  sendPush(user.deviceToken),
  logToAudit(action),
]);

// results: [
//   { status: 'fulfilled', value: ... },
//   { status: 'rejected', reason: Error },   ← push упал, но email и аудит ок
//   { status: 'fulfilled', value: ... },
// ]

// Проверяем что критичное не упало:
const failed = results.filter(r => r.status === 'rejected');
if (failed.length > 0) {
  console.warn('Some notifications failed:', failed);
}
```

---

## 5. Buffers

### Зачем Buffer, если есть string?

На фронте ты работал с текстом: JSON, строки, HTML. На сервере ты работаешь с **байтами**: сетевые пакеты, файлы, изображения, шифрование, хеши.

`string` в JavaScript — это **Unicode текст** (UTF-16 внутри V8). `Buffer` — это **массив сырых байтов**.

**Критическая разница — символы ≠ байты:**

```typescript
const text = 'Привет';
console.log(text.length);              // 6 (символов)
console.log(Buffer.byteLength(text));  // 12 (байт — кириллица = 2 байта в UTF-8!)
```

**Где это стреляет на проде:** `Content-Length` в HTTP — это **байты**, не символы. Отправишь `Content-Length: 6` для кириллического текста — клиент получит обрезанный ответ или зависнет ожидая оставшиеся байты.

```typescript
const body = JSON.stringify({ name: 'Дмитрий' });
// ❌ body.length = 21 (символы JS)
// ✅ Buffer.byteLength(body) = 27 (UTF-8 байты, кириллица по 2)
// Если послать неправильный Content-Length — клиент обрежет или повиснет
res.setHeader('Content-Length', Buffer.byteLength(body));
```

### Где Buffer живёт в памяти

Buffer хранится **ВНЕ V8 Heap** — в нативной памяти C++. Это значит:
1. **Не нагружает GC** — Garbage Collector не сканирует содержимое Buffer'а
2. Виден в `process.memoryUsage().external`, а **не** в `heapUsed`
3. Для больших данных (изображения, видео) это эффективнее, чем JS-массивы

### Создание Buffer'ов

```typescript
// Из строки
const buf1 = Buffer.from('Hello');
console.log(buf1);        // <Buffer 48 65 6c 6c 6f>
//                                  H  e  l  l  o  (ASCII коды в hex)
console.log(buf1.length);  // 5 (байт)

// Из строки UTF-8 (кириллица = 2 байта на символ!)
const buf2 = Buffer.from('Привет');
console.log(buf2.length);     // 12 (НЕ 6!)
console.log('Привет'.length); // 6 (JS считает символы, не байты)

// Пустой буфер заданного размера
const buf3 = Buffer.alloc(10);       // 10 нулевых байт, безопасный
const buf4 = Buffer.allocUnsafe(10); // 10 байт, может содержать мусор из памяти!
// ⚠ allocUnsafe быстрее, но ОПАСЕН — может слить данные предыдущих операций!
// Используй alloc() если заполняешь не сразу
```

### Операции с Buffer

```typescript
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
```

### Где Buffer используется в реальном коде

```typescript
// 1. В HTTP-запросах — req.on('data') приходит как Buffer
import { createServer } from 'node:http';

createServer((req, res) => {
  const chunks: Buffer[] = [];  // массив Buffer'ов

  req.on('data', (chunk: Buffer) => {
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
res.setHeader('Content-Length', Buffer.byteLength(body));

// 3. Хеширование (crypto)
import { createHash } from 'node:crypto';
const hash = createHash('sha256')
  .update(Buffer.from('password123'))
  .digest('hex');
// '... 64 hex символа ...'
```

🎯 **На собесе:** «Что такое Buffer? Зачем он нужен, если есть string?» → «Buffer работает с бинарными данными (сырыми байтами), string — с Unicode-текстом. Buffer живёт вне V8 heap в нативной памяти C++, не нагружает GC. Нужен для I/O: сеть, файлы, crypto. Главный подводный камень — `string.length` считает символы, а `Buffer.byteLength()` — байты. Для Content-Length нужны байты, иначе ответ обрежется.»

---

## 6. Streams

### Концепция — зачем нужны

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

| Тип | Что делает | Примеры |
|---|---|---|
| **Readable** | Источник данных (из него читают) | `fs.createReadStream`, `http request` (req), `process.stdin` |
| **Writable** | Приёмник данных (в него пишут) | `fs.createWriteStream`, `http response` (res), `process.stdout` |
| **Transform** | Читает → преобразует → отдаёт | `zlib.createGzip()`, `crypto.createCipher()` |
| **Duplex** | И читает и пишет (независимо) | `net.Socket`, WebSocket |

```typescript
import { Readable, Writable, Transform, Duplex } from 'node:stream';

// Readable: события 'data', 'end', 'error', 'close'
//           методы .read(), .pipe(), .destroy()

// Writable: события 'drain', 'finish', 'error', 'close'
//           методы .write(), .end(), .destroy()

// Transform: принимает данные → модифицирует → передаёт дальше

// Duplex: два канала — чтение и запись не связаны
```

### Readable Stream

```typescript
import { createReadStream } from 'node:fs';

// Способ 1: Event-based (flowing mode)
const stream = createReadStream('data.csv', {
  encoding: 'utf-8',         // по умолчанию null (Buffer)
  highWaterMark: 64 * 1024,  // размер чанка: 64 KB (по умолчанию)
});

stream.on('data', (chunk) => {
  console.log(`Got ${chunk.length} bytes`);
});

stream.on('end', () => {
  console.log('Файл полностью прочитан');
});

stream.on('error', (err) => {
  console.error('Ошибка чтения:', err.message);
});

// Способ 2: for-await (рекомендуемый — чище и проще)
const stream2 = createReadStream('data.csv', { encoding: 'utf-8' });

for await (const chunk of stream2) {
  console.log(`Got ${chunk.length} bytes`);
  // Автоматически обрабатывает backpressure!
}
console.log('Файл полностью прочитан');
```

### Writable Stream

```typescript
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

**Backpressure** — ситуация, когда источник данных (Readable) производит данные **быстрее**, чем приёмник (Writable) может их обработать.

```
Без backpressure:
  Readable (SSD, 500 MB/s) → → → → → Writable (сеть, 10 MB/s)
                                      ↑ буфер растёт бесконечно = OOM!

С backpressure:
  Readable (пауза) ──────── → → Writable (сеть, 10 MB/s)
                  ↑ «подожди!»   ↑ «готов, давай ещё»
```

Как stream'ы решают backpressure:
1. `writable.write(chunk)` возвращает `false` если буфер полон
2. При `false` — readable приостанавливается (pause)
3. Когда буфер свободен — writable эмитит `'drain'`
4. Readable возобновляет чтение

**`pipeline()` делает это автоматически.** Ты не думаешь о backpressure — pipeline сам управляет паузами.

### pipeline vs pipe — почему pipeline

```typescript
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

### Transform Stream — пример

```typescript
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

### Реальный пример для Omnia

```typescript
// Пользователь загружает CSV с контактами (может быть 100 MB)
// Нужно: прочитать, распарсить, записать в базу батчами

import { Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createReadStream } from 'node:fs';

// Transform: собирает записи в батчи по 100
class BatchTransform extends Transform {
  private batch: Record<string, unknown>[] = [];

  constructor() {
    super({ objectMode: true }); // objectMode: чанки = JS-объекты, не Buffer
  }

  _transform(record: Record<string, unknown>, encoding: string, callback: () => void) {
    this.batch.push(record);
    if (this.batch.length >= 100) {
      this.push(this.batch);  // отправляем батч дальше
      this.batch = [];
    }
    callback();
  }

  _flush(callback: () => void) {
    // Вызывается когда входящие данные закончились
    if (this.batch.length > 0) {
      this.push(this.batch); // отправляем остаток
    }
    callback();
  }
}

// Writable: пишет батч в базу
class DbWriter extends Writable {
  constructor(private db: any) {
    super({ objectMode: true });
  }

  async _write(
    batch: Record<string, unknown>[],
    encoding: string,
    callback: (error?: Error) => void,
  ) {
    try {
      await this.db.batchInsert('contacts', batch);
      callback();
    } catch (error) {
      callback(error as Error); // pipeline поймает
    }
  }
}
```

🎯 **На собесе:** «readFile vs createReadStream?» → «readFile загружает весь файл в память — подходит для маленьких файлов (< 10 MB, конфиги). createReadStream читает порциями — обязателен для больших файлов и файлов неизвестного размера, потребляет ~64 KB вместо полного размера файла. Для цепочки стримов — pipeline, не pipe, потому что pipeline управляет backpressure и корректно закрывает все стримы при ошибке.»

---

## 7. File System

### Три API — и когда какое

Node.js даёт три варианта работы с файлами:

| API | Блокирует? | Когда использовать |
|---|---|---|
| `fs` (callback) | Нет | Legacy, не используй в новом коде |
| `fs/promises` | Нет | ✅ **Всегда используй это** |
| `fs` sync-методы | **ДА** | ✅ Только при старте (до `server.listen()`) |

```typescript
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

```typescript
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

// ── УДАЛЕНИЕ ───────────────────────────────────────

await rm('temp.txt');
await rm('temp-folder', { recursive: true, force: true });

// ── ПЕРЕИМЕНОВАНИЕ / ПЕРЕМЕЩЕНИЕ ───────────────────

await rename('old-name.txt', 'new-name.txt');
await rename('file.txt', 'archive/file.txt'); // перемещение
```

### Антипаттерн: проверка существования файла

```typescript
// ❌ Race condition — файл может быть удалён между проверкой и чтением
if (await exists('file.json')) {
  const data = await readFile('file.json');  // → ENOENT!
}

// ✅ EAFP (Easier to Ask Forgiveness than Permission)
// Просто читай и обрабатывай ошибку:
try {
  const data = await readFile('maybe-exists.json', 'utf-8');
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('Файл не найден');
  } else {
    throw error; // другая ошибка — пробрасываем
  }
}

// Если реально нужно только проверить (без чтения):
try {
  await access('file.txt', constants.R_OK);
  console.log('Файл существует и доступен для чтения');
} catch {
  console.log('Файл недоступен');
}
```

### readFile vs createReadStream — когда что

```typescript
// ┌──────────────────────────────────────────────────────────┐
// │                    ПРАВИЛО                               │
// │                                                          │
// │  Файл < 10 MB  →  readFile (проще, весь файл в памяти)  │
// │  Файл > 10 MB  →  createReadStream (поток, экономит RAM) │
// │  Неизвестный размер → createReadStream (безопасно)        │
// └──────────────────────────────────────────────────────────┘

import { readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';

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
| `EMFILE` | Too many open files | Открыли слишком много файлов одновременно (утечка fd) |
| `ENOSPC` | No space left on device | Диск заполнен |

```typescript
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

🎯 **На собесе:** «readFileSync — когда допустим?» → «Только при старте приложения (до server.listen()). Для чтения конфига, SSL-сертификатов, .env. НИКОГДА внутри обработчика запросов — заблокирует Event Loop и ВСЕ клиенты будут ждать.»

---

## 8. Path, OS, Process

### Path — безопасная работа с путями

```typescript
import { join, resolve, basename, dirname, extname, parse, relative, sep } from 'node:path';

// join — склеивает части пути через разделитель ОС
join('uploads', 'avatars', 'user-123.png');
// macOS/Linux: 'uploads/avatars/user-123.png'
// Windows:     'uploads\\avatars\\user-123.png'

// ❌ НИКОГДА не конкатенируй строки для путей:
// 'uploads/' + userInput  ← PATH TRAVERSAL ATTACK!
// Если userInput = '../../etc/passwd' → читаешь системный файл!

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

🎯 **На собесе:** «Как защититься от Path Traversal?» → «Никогда не конкатенировать пользовательский ввод с путём. Использовать `path.basename()` чтобы отсечь `../`. Проверять, что resolved path начинается с разрешённой директории.»

### OS — информация о системе

```typescript
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

```typescript
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

// ── Измерение времени (Performance) ────────────────
const start = process.hrtime.bigint();
// ... тяжёлая операция ...
const end = process.hrtime.bigint();
console.log(`Операция заняла ${Number(end - start) / 1_000_000} мс`);
// hrtime.bigint() точнее чем Date.now() и не зависит от синхронизации часов ОС (NTP)
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

Если `heapUsed` растёт монотонно и не снижается после GC — **утечка памяти**.

### Graceful Shutdown (★ критично для продакшена)

Когда Docker/Kubernetes останавливает контейнер — он посылает `SIGTERM`. Без graceful shutdown: Docker убивает процесс через 30 секунд `SIGKILL` → оборванные транзакции, потерянные данные, битые соединения.

```typescript
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
```

### Необработанные ошибки — последний рубеж

```typescript
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  // Залогировать и УМЕРЕТЬ — состояние процесса непредсказуемо
  // Нельзя просто проглотить и продолжить — данные в памяти могут быть повреждены
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  // В Node 15+ это крашит процесс автоматически
});
```

### Версии

```typescript
console.log(process.version);   // 'v22.5.0' ⚠ проверить
console.log(process.versions);  // { v8: '12.4...', openssl: '3.0...', ... }
```

---

## 9. EventEmitter и Событийно-ориентированная архитектура

Node.js буквально построен вокруг событий. Почти все базовые модули (http, fs, stream, process) наследуются от `EventEmitter`.

```typescript
import { EventEmitter } from 'node:events';

// 1. Создаём свой эмиттер
class OrderService extends EventEmitter {
  createOrder(orderData) {
    // ... логика сохранения в БД ...
    const orderId = 42;
    
    // Эмитим событие (публикуем)
    this.emit('orderCreated', { id: orderId, amount: 100 });
  }
}

const orders = new OrderService();

// 2. Подписываемся на события
orders.on('orderCreated', (event) => {
  console.log(`Отправляем email для заказа ${event.id}`);
});

orders.once('orderCreated', () => {
  // Выполнится ТОЛЬКО один раз (для самого первого заказа)
});

orders.createOrder({});
```

**Где это встречается под капотом:**
- Streams: `stream.on('data')`, `stream.on('end')`
- HTTP: `server.on('request')`
- Process: `process.on('uncaughtException')`

**Важно:** `EventEmitter` в Node.js работает **синхронно** по умолчанию! Если ты вызываешь `emit('event')`, все listener'ы выполнятся синхронно в том же тике Event Loop, блокируя выполнение следующего за `emit` кода.

---

## 10. Worker Threads, Cluster и Child Process

**Миф:** Node.js = строго один поток, и он не может использовать все ядра процессора.
**Правда:** У Node.js есть несколько механизмов для масштабирования и CPU-bound задач.

### Cluster (Использование всех ядер)

Позволяет запустить несколько экземпляров твоего HTTP-сервера, которые будут делить один порт (например, `3000`).

```typescript
import cluster from 'node:cluster';
import http from 'node:http';
import os from 'node:os';

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  // Основной процесс (Primary) только роутит соединения
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork(); // Создаём рабочий процесс на каждое ядро
  }
} else {
  // Рабочие процессы (Workers) реально обрабатывают HTTP
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Hello World\n');
  }).listen(8000);
}
```
*На практике вместо ручного кода используют `PM2` или Docker/Kubernetes replicas.*

### Worker Threads (CPU-bound задачи)

Для задач, которые требуют долгих вычислений (парсинг гигантских JSON, кодирование видео, AI inference, генерация PDF). Если сделать это в главном потоке — сервер зависнет (Event Loop заблокирован).

```typescript
import { Worker, isMainThread, parentPort } from 'node:worker_threads';

if (isMainThread) {
  // Главный поток отдаёт задачу воркеру
  const worker = new Worker(__filename);
  worker.on('message', (result) => console.log('Результат:', result));
  worker.postMessage('Запусти тяжёлую задачу');
} else {
  // Выполняется в ОТДЕЛЬНОМ потоке V8
  parentPort.on('message', (msg) => {
    // Тяжёлые вычисления (не блокируют основной сервер!)
    let sum = 0;
    for (let i = 0; i < 1e9; i++) sum += i;
    parentPort.postMessage(sum);
  });
}
```
**Отличие от libuv thread pool:** libuv thread pool управляется Node.js неявно (для I/O и `crypto`). `worker_threads` создаёшь ты сам для выполнения **своего JS кода** в фоне.

---

## 11. AbortController (Отмена операций)

В современном Node.js (и на фронтенде) `AbortController` стал индустриальным стандартом для отмены зависших или ненужных операций (fetch, таймеры, стримы).

```typescript
// 1. Создаём контроллер
const controller = new AbortController();
const signal = controller.signal;

// 2. Передаём сигнал в операцию
setTimeout(() => console.log('Не выполнится'), 5000, { signal });

// 3. Отменяем операцию через 1 секунду
setTimeout(() => controller.abort(), 1000);

// Пример с fetch:
try {
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 3000); // Таймаут 3 секунды
  await fetch('https://api.openai.com/v1/models', { signal: ac.signal });
} catch (error) {
  if (error.name === 'AbortError') console.log('Таймаут запроса');
}
```

---

## 12. Шпаргалка для собеседования

| Вопрос | Эталонный ответ |
|---|---|
| Что такое Node.js? | Рантайм на V8 + libuv. Event-driven, non-blocking I/O. Один JS-поток, но I/O через ОС + thread pool |
| Фазы Event Loop? | timers → pending → idle → **poll** → check → close. Между фазами — nextTick + microtask |
| nextTick vs Promise.then? | nextTick приоритетнее. Оба выполняются между фазами. nextTick может вызвать I/O starvation |
| setTimeout(0) vs setImmediate? | В I/O callback — setImmediate всегда первый (check после poll). В top-level — недетерминировано |
| Что блокирует Event Loop? | Тяжёлые sync-вычисления, `*Sync` методы fs. Решение: worker_threads или chunking |
| Что такое Buffer? | Контейнер для бинарных данных вне V8 heap. `Buffer.byteLength` ≠ `string.length` для UTF-8 |
| readFile vs createReadStream? | readFile — всё в RAM. Stream — порциями (~64 KB). Stream для > 10 MB |
| Что такое backpressure? | Readable быстрее Writable → буфер растёт → OOM. pipeline решает автоматически |
| pipeline vs pipe? | pipeline управляет backpressure + пробрасывает ошибки + закрывает стримы. pipe — legacy |
| readFileSync — когда допустим? | При старте (до listen). **Никогда** в обработчике запроса |
| Graceful shutdown — зачем? | SIGTERM → закрыть сервер → дождаться запросов → закрыть пул БД → exit(0) |
| Path Traversal — как защититься? | `path.basename()` отсекает ../. Проверять что resolved path внутри разрешённой директории |
| EventEmitter синхронен? | Да. `emit()` блокирует выполнение, пока все слушатели не отработают. |
| Зачем Worker Threads? | Для тяжелых вычислений (CPU-bound) на JS, чтобы не блокировать Event Loop. |
| AbortController? | Стандарт для отмены асинхронных операций (fetch, setTimeout, потоки). |
| Что регулирует UV_THREADPOOL_SIZE? | Размер пула потоков libuv для блокирующего I/O (fs, crypto, dns). По умолчанию 4. |

---

## 13. Чек-поинт

«Понял, когда...»

- [ ] Можешь предсказать порядок выполнения для смеси `setTimeout`, `setImmediate`, `nextTick`, `Promise.then`
- [ ] Объясняешь **зачем** Event Loop существует (проблему многопоточности), а не просто какие у него фазы
- [ ] Знаешь разницу `readFile` vs `createReadStream` и когда какой
- [ ] Понимаешь backpressure и почему `pipeline`, а не `pipe`
- [ ] Можешь написать `graceful shutdown` для Node.js процесса
- [ ] Знаешь про `Buffer.byteLength` vs `string.length` для Content-Length
- [ ] Не путаешь `await` (пауза функции, стек свободен) с блокировкой (стек занят)

---

## Что дальше — практика

После изучения теории → переходи к практическим заданиям, которые сделают из тебя Senior Backend Foundation разработчика:

1. 🔴 **Собственный Роутер (без Express)**
   Напиши на чистом `node:http` класс `Router`, который позволит объявлять маршруты так:
   `router.get('/users/:id', handler)` и `router.post('/users', handler)`.
2. 🔴 **Собственная Middleware-система**
   Добавь поддержку цепочки middleware: `logger`, `json parser`, `cors`. Как в Express, через функцию `next()`.
3. 🟡 **Собственный EventEmitter**
   Напиши класс `EventEmitter` с нуля: реализуй методы `on()`, `emit()`, `off()` и `once()`.
4. 🟡 **Собственный Readable Stream**
   Реализуй кастомный Readable Stream (наследуясь от `Readable` из `node:stream`), который генерирует бесконечную последовательность случайных чисел.
5. 🟢 **Worker Threads Benchmarking**
   Создай CPU-bound задачу (например, цикл на 10 миллиардов итераций) и сравни время её выполнения в главном потоке (заблокировав Event Loop) и в 4 параллельных Worker Threads.
