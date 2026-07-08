# Omnia Backend Roadmap — Практика

Код практических заданий по [Backend Roadmap v2](docs/omnia_backend_roadmap_v2.md).

## Структура проекта

```
roadmap-backend/
├── docs/
│   ├── omnia_backend_roadmap_v2.md    # Роадмап на 40 недель
│   └── study_notes/
│       ├── week1/                     # Учебный гайд: HTTP & сети
│       └── week2/                     # Учебный гайд: Node.js internals
│
├── src/
│   ├── week1/                         # Практика недели 1
│   │   └── tcp-server.js             # HTTP-сервер на голом TCP (net.createServer)
│   │
│   ├── week2/                         # Практика недели 2
│   │   ├── router.js                 # 🔴 Задание 1: собственный класс Router
│   │   ├── middleware.js             # 🔴 Задание 2: middleware-система (logger, json, cors)
│   │   ├── server.js                 # 🔴 DELIVERABLE: REST API = Router + Middleware
│   │   ├── event-emitter.js          # 🟡 Задание 3: EventEmitter с нуля
│   │   ├── custom-stream.js          # 🟡 Задание 4: кастомный Readable Stream
│   │   └── worker-bench.js           # 🟢 Задание 5: Worker Threads benchmarking
│   │
│   ├── week3/                         # (будет) Express — структура и middleware
│   └── week4/                         # (будет) Auth: JWT, Cookies, Sessions
│
├── MENTOR_PROMPT.md                   # Промпт для AI-ментора
├── progress.md                        # Прогресс обучения
└── package.json
```

## Как запускать

```bash
# Неделя 1
node src/week1/tcp-server.js

# Неделя 2 — каждый файл можно запускать отдельно
node src/week2/router.js          # тестовый сервер роутера
node src/week2/middleware.js       # тестовый сервер middleware
node src/week2/server.js           # финальный сервер (deliverable)
node src/week2/event-emitter.js    # тесты EventEmitter
node src/week2/custom-stream.js    # тесты стримов
node src/week2/worker-bench.js     # бенчмарк воркеров
```

## Легенда приоритетов

- 🔴 **MUST** — без этого неделя не закрыта
- 🟡 **Nice to have** — сделать если есть время
- 🟢 **По остатку** — бонус для глубокого понимания
