// ============================================================
// НЕДЕЛЯ 2 · DELIVERABLE
// REST API сервер на чистом Node.js (TypeScript)
//
// Запуск: npx tsx src/week2/server.ts
// ============================================================

import { createServer } from 'node:http'
import { Router } from './router.js'
import type { RouteRequest, HTTPMethod } from './router.js'
import { createApp, loggerMiddleware, jsonParserMiddleware, corsMiddleware } from './middleware.js'

// ---- In-memory хранилище ----
interface User {
	id: string
	name: string
	email: string
}

const users: User[] = [
	{ id: '1', name: 'Dzmitry', email: 'dzmitry@omnia.dev' },
	{ id: '2', name: 'Alice', email: 'alice@omnia.dev' },
]
let nextId = 3

// ---- Роутер ----
const router = new Router()

router.get('/health', (_req, res) => {
	res.writeHead(200, { 'Content-Type': 'application/json' })
	res.end(
		JSON.stringify({
			status: 'ok',
			uptime: process.uptime(),
			memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`,
		}),
	)
})

router.get('/users', (_req, res) => {
	// TODO: вернуть список users
	res.writeHead(200, { 'Content-Type': 'application/json' })
	res.end(JSON.stringify(users))
})

router.get('/users/:id', (req, res) => {
	const user = users.find(u => u.id === req.params.id)
	if (!user) {
		res.writeHead(404, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ error: 'User not found' }))
		return
	}
	res.writeHead(200, { 'Content-Type': 'application/json' })
	res.end(JSON.stringify(user))
})

router.post('/users', (req, res) => {
	const body = req.body as Record<string, unknown> | null
	if (!body || typeof body.name !== 'string' || typeof body.email !== 'string') {
		res.writeHead(400, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ error: 'name (string) and email (string) are required' }))
		return
	}
	const newUser: User = { id: String(nextId++), name: body.name, email: body.email }
	users.push(newUser)
	res.writeHead(201, { 'Content-Type': 'application/json' })
	res.end(JSON.stringify(newUser))
})

router.put('/users/:id', (req, res) => {
	const index = users.findIndex(u => u.id === req.params.id)
	if (index === -1) {
		res.writeHead(404, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ error: 'User not found' }))
		return
	}
	const body = req.body as Record<string, unknown> | null
	if (!body || typeof body.name !== 'string' || typeof body.email !== 'string') {
		res.writeHead(400, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ error: 'name (string) and email (string) are required' }))
		return
	}
	const id = req.params.id
	if (!id) {
		res.writeHead(400, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ error: 'Missing id parameter' }))
		return
	}
	users[index] = { id, name: body.name, email: body.email }
	res.writeHead(200, { 'Content-Type': 'application/json' })
	res.end(JSON.stringify(users[index]))
})

router.delete('/users/:id', (req, res) => {
	const index = users.findIndex(u => u.id === req.params.id)
	if (index === -1) {
		res.writeHead(404, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ error: 'User not found' }))
		return
	}
	users.splice(index, 1)
	res.writeHead(204)
	res.end()
})

// ---- Middleware + Router ----
const app = createApp()

app.use(corsMiddleware)
app.use(loggerMiddleware)
app.use(jsonParserMiddleware)

// Финальный middleware — роутер
app.use((req, res) => {
	const result = router.match((req.method ?? 'GET') as HTTPMethod, req.url ?? '/')

	if (!result) {
		res.writeHead(404, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ error: 'Not Found' }))
		return
	}

	req.params = result.params
	result.handler(req, res)
})

// ---- Запуск ----
const PORT = parseInt(process.env.PORT ?? '3000', 10)

const server = createServer((req, res) => {
	app.handle(req as RouteRequest, res)
})

server.listen(PORT, () => {
	console.log(`
🚀 Omnia API Server (Week 2 — Pure Node.js + TypeScript)
   http://localhost:${PORT}

   Endpoints:
   GET    /health
   GET    /users
   GET    /users/:id
   POST   /users
   PUT    /users/:id
   DELETE /users/:id

   Middleware: CORS → Logger → JSON Parser → Router
  `)
})

// ---- Graceful Shutdown ----
process.on('SIGTERM', () => {
	console.log('\n⏹  SIGTERM — shutting down...')
	server.close(() => {
		console.log('   Server closed. Bye! 👋')
		process.exit(0)
	})
})

process.on('SIGINT', () => {
	console.log('\n⏹  SIGINT (Ctrl+C) — shutting down...')
	server.close(() => {
		console.log('   Server closed. Bye! 👋')
		process.exit(0)
	})
})
