# Omnia Backend Roadmap — Практика

Код практических заданий по [Backend Roadmap v2](docs/omnia_backend_roadmap_v2.md).

**Стек:** TypeScript · Node.js · tsx

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
│   ├── week2/                         # Практика недели 2 (TypeScript)
│   │   ├── router.ts                 # 🔴 Задание 1: собственный класс Router
│   │   ├── middleware.ts             # 🔴 Задание 2: middleware-система (logger, json, cors)
│   │   ├── server.ts                 # 🔴 DELIVERABLE: REST API = Router + Middleware
│   │   ├── event-emitter.ts          # 🟡 Задание 3: EventEmitter с нуля
│   │   ├── custom-stream.ts          # 🟡 Задание 4: кастомный Readable Stream
│   │   └── worker-bench.ts           # 🟢 Задание 5: Worker Threads benchmarking
│   │
│   ├── week3/                         # (будет) Express — структура и middleware
│   └── week4/                         # (будет) Auth: JWT, Cookies, Sessions
│
├── MENTOR_PROMPT.md                   # Промпт для AI-ментора
├── progress.md                        # Прогресс обучения
├── tsconfig.json                      # TypeScript конфиг (strict mode)
└── package.json
```

## Как запускать

```bash
# Неделя 1 (JS)
node src/week1/tcp-server.js

# Неделя 2 (TypeScript) — через tsx
npx tsx src/week2/router.ts          # тестовый сервер роутера
npx tsx src/week2/middleware.ts       # тестовый сервер middleware
npx tsx src/week2/server.ts           # финальный сервер (deliverable)
npx tsx src/week2/event-emitter.ts    # тесты EventEmitter
npx tsx src/week2/custom-stream.ts    # тесты стримов
npx tsx src/week2/worker-bench.ts     # бенчмарк воркеров

# Проверка типов (без запуска)
npm run typecheck
```

## Легенда приоритетов

- 🔴 **MUST** — без этого неделя не закрыта
- 🟡 **Nice to have** — сделать если есть время
- 🟢 **По остатку** — бонус для глубокого понимания
