// ============================================================
// НЕДЕЛЯ 2 · Задание 2 (🔴 MUST)
// Собственная Middleware-система
//
// Запуск: npx tsx src/week2/middleware.ts
// ============================================================

import type { ServerResponse } from 'node:http'
import type { RouteRequest } from './router.js'

export type NextFunction = (err?: Error) => void
export type Middleware = (
	req: RouteRequest,
	res: ServerResponse,
	next: NextFunction,
) => void

interface App {
	use: (fn: Middleware) => void
	handle: (req: RouteRequest, res: ServerResponse) => void
}

function createApp(): App {
	const middlewares: Middleware[] = []

	function use(fn: Middleware): void {
		// TODO: добавить middleware в массив
		middlewares.push(fn)
	}

	function handle(req: RouteRequest, res: ServerResponse) {
		let index = 0

		function next(err?: Error): void {
			if (err) {
				// Если кто-то передал ошибку в next(err) -> сразу отдаем 500
				res.statusCode = 500
				res.setHeader('Content-Type', 'application/json')
				res.end(
					JSON.stringify({ error: err.message || 'Internal Server Error' }),
				)
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

	return { use, handle }
}

export { createApp }

// ============================================================
// Готовые middleware — реализуй логику внутри
// ============================================================

/**
 * Logger middleware
 * Логирует: метод, URL, статус, время выполнения
 */
export function loggerMiddleware(
	req: RouteRequest,
	res: ServerResponse,
	next: NextFunction,
): void {
	const start = process.hrtime.bigint()

	// Подписываемся на 'finish' — вызывается Node.js когда ответ полностью отправлен.
	// Это каноничный паттерн (morgan так делает), надёжнее monkey-patch res.end.
	res.on('finish', () => {
		const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000
		console.log(
			`[${req.method}] ${req.url} - Status: ${res.statusCode} - ${durationMs.toFixed(2)}ms`,
		)
	})

	next()
}

/**
 * JSON Parser middleware
 * Собирает body из чанков, парсит JSON, кладёт в req.body
 */
const MAX_BODY_SIZE = 1024 * 1024 // 1MB — защита от DoS (10GB JSON = OOM)

export function jsonParserMiddleware(
	req: RouteRequest,
	res: ServerResponse,
	next: NextFunction,
): void {
	const contentType = req.headers['content-type']

	if (!contentType?.includes('application/json')) {
		next()
		return
	}

	const chunks: Buffer[] = []
	let totalSize = 0

	req.on('data', (chunk: Buffer) => {
		totalSize += chunk.length
		if (totalSize > MAX_BODY_SIZE) {
			res.statusCode = 413
			res.setHeader('Content-Type', 'application/json')
			res.end(JSON.stringify({ error: 'Payload Too Large' }))
			req.destroy()
			return
		}
		chunks.push(chunk)
	})

	req.on('end', () => {
		try {
			const raw = Buffer.concat(chunks).toString('utf-8')
			req.body = raw ? JSON.parse(raw) : null
			next()
		} catch {
			res.statusCode = 400
			res.setHeader('Content-Type', 'application/json')
			res.end(JSON.stringify({ error: 'Invalid JSON payload' }))
		}
	})

	req.on('error', err => {
		next(err)
	})
}

/**
 * CORS middleware
 * Добавляет заголовки для Cross-Origin запросов
 */
export function corsMiddleware(
	req: RouteRequest,
	res: ServerResponse,
	next: NextFunction,
): void {
	const origin = req.headers.origin

	res.setHeader('Access-Control-Allow-Origin', origin ?? '*')
	res.setHeader(
		'Access-Control-Allow-Methods',
		'GET, POST, PUT, PATCH, DELETE, OPTIONS',
	)
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
	res.setHeader('Access-Control-Max-Age', '86400') // Кэш preflight на 24ч

	if (req.method === 'OPTIONS') {
		res.statusCode = 204
		res.end()
		return
	}

	next()
}

// ============================================================
// Тестовый сервер
// ============================================================
if (import.meta.url === `file://${process.argv[1]}`) {
	const { createServer } = await import('node:http')

	const app = createApp()

	app.use(corsMiddleware)
	app.use(loggerMiddleware)
	app.use(jsonParserMiddleware)

	app.use((req, res) => {
		res.writeHead(200, { 'Content-Type': 'application/json' })
		res.end(
			JSON.stringify({
				message: 'Hello from middleware chain!',
				body: req.body ?? null,
			}),
		)
	})

	const server = createServer((req, res) => {
		app.handle(req as RouteRequest, res)
	})

	server.listen(3000, () => {
		console.log('🚀 Middleware server на http://localhost:3000')
		console.log('   curl http://localhost:3000')
		console.log(
			'   curl -X POST http://localhost:3000 -H "Content-Type: application/json" -d \'{"name":"test"}\'',
		)
	})
}
