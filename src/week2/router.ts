// ============================================================
// НЕДЕЛЯ 2 · Задание 1 (🔴 MUST)
// Собственный Роутер на чистом node:http
//
// Запуск: npx tsx src/week2/router.ts
// Тест:   curl http://localhost:3000/users
//         curl http://localhost:3000/users/42
//         curl -X POST http://localhost:3000/users -d '{"name":"Dzmitry"}'
// ============================================================

import type { IncomingMessage, ServerResponse } from 'node:http'

// Расширяем IncomingMessage — добавляем params и body
export interface RouteRequest extends IncomingMessage {
	params: Record<string, string>
	body?: unknown
}

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type RouteHandler = (req: RouteRequest, res: ServerResponse) => void

interface Route {
	method: HTTPMethod
	pattern: RegExp
	paramNames: string[]
	handler: RouteHandler
}

export interface MatchResult {
	handler: RouteHandler
	params: Record<string, string>
}

class Router {
	private routes: Route[] = []

	addRoute(method: HTTPMethod, path: string, handler: RouteHandler): void {
		const paramNames: string[] = []

		// 1. Разбиваем путь на сегменты и обрабатываем каждый:
		//    - параметр (:id) → захватывающая группа
		//    - статический сегмент → экранируем спецсимволы RegExp
		const segments = path.split('/').map(segment => {
			if (segment.startsWith(':')) {
				paramNames.push(segment.slice(1))
				return '([^/]+)'
			}
			// Экранируем спецсимволы только в статических сегментах
			return segment.replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
		})

		const pattern = new RegExp(`^${segments.join('/')}$`)

		this.routes.push({
			method,
			pattern,
			paramNames,
			handler,
		})
	}

	// Удобные обёртки
	get(path: string, handler: RouteHandler): void {
		this.addRoute('GET', path, handler)
	}
	post(path: string, handler: RouteHandler): void {
		this.addRoute('POST', path, handler)
	}
	put(path: string, handler: RouteHandler): void {
		this.addRoute('PUT', path, handler)
	}
	patch(path: string, handler: RouteHandler): void {
		this.addRoute('PATCH', path, handler)
	}
	delete(path: string, handler: RouteHandler): void {
		this.addRoute('DELETE', path, handler)
	}

	match(method: HTTPMethod, url: string): MatchResult | null {
		// 1. Бэкенд-важно: отсекаем query-string (?foo=bar), нам нужен только pathname
		const [pathname] = url.split('?')
		if (!pathname) {
			return null
		}

		for (const route of this.routes) {
			if (route.method !== method) continue

			const matchResult = route.pattern.exec(pathname)

			if (matchResult) {
				// 4. Извлекаем параметры
				const params = route.paramNames.reduce<Record<string, string>>(
					(acc, name, index) => {
						// matchResult[0] — это сам URL, параметры начинаются с индекса 1
						acc[name] = matchResult[index + 1] ?? ''
						return acc
					},
					{},
				)

				// 5. Возвращаем найденный хэндлер и параметры
				return { handler: route.handler, params }
			}
		}

		return null
	}
}

export { Router }

// ============================================================
// Тестовый сервер (запуск напрямую)
// ============================================================
if (import.meta.url === `file://${process.argv[1]}`) {
	const { createServer } = await import('node:http')

	const router = new Router()

	router.get('/users', (_req, res) => {
		res.writeHead(200, { 'Content-Type': 'application/json' })
		res.end(
			JSON.stringify([
				{ id: 1, name: 'Dzmitry' },
				{ id: 2, name: 'Alice' },
			]),
		)
	})

	router.get('/users/:id', (req, res) => {
		res.writeHead(200, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ id: req.params.id, name: 'Dzmitry' }))
	})

	router.post('/users', (req, res) => {
		res.writeHead(201, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ id: 3, ...(req.body as object) }))
	})

	router.delete('/users/:id', (_req, res) => {
		res.writeHead(204)
		res.end()
	})

	const server = createServer((req, res) => {
		const result = router.match(
			(req.method ?? 'GET') as HTTPMethod,
			req.url ?? '/',
		)

		if (!result) {
			res.writeHead(404, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ error: 'Not Found' }))
			return
		}

		const routeReq = req as RouteRequest
		routeReq.params = result.params

		result.handler(routeReq, res)
	})

	server.listen(3000, () => {
		console.log('🚀 Router server на http://localhost:3000')
		console.log('   GET  /users')
		console.log('   GET  /users/:id')
		console.log('   POST /users')
		console.log('   DEL  /users/:id')
	})
}
