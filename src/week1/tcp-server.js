// ============================================================
// НЕДЕЛЯ 1 · HTTP & Сети
// Практика: HTTP-сервер на голом TCP (node:net)
//
// Этот файл перенесён из корня проекта для порядка.
// Оригинальное задание: написать HTTP-сервер без node:http,
// вручную парсить request line, headers, body.
// ============================================================

import * as net from 'node:net'
import * as crypto from 'node:crypto'

/**
 * Вспомогательная функция для сборки HTTP-ответа.
 * Формирует строку по спецификации HTTP/1.1.
 */
function buildResponse(statusCode, statusText, body = null, extraHeaders = {}) {
	const requestId = crypto.randomUUID()
	let response = `HTTP/1.1 ${statusCode} ${statusText}\r\n`

	// Базовые заголовки, обязательные для продакшена/собеседований
	response += `X-Request-Id: ${requestId}\r\n`
	response += `Connection: close\r\n`

	// Применяем дополнительные заголовки (например, Location)
	for (const [key, value] of Object.entries(extraHeaders)) {
		response += `${key}: ${value}\r\n`
	}

	if (body !== null) {
		const json = JSON.stringify(body)
		response += `Content-Type: application/json; charset=utf-8\r\n`
		response += `Content-Length: ${Buffer.byteLength(json)}\r\n`
		response += `\r\n`
		response += json
	} else {
		// Для 204 No Content тела и Content-Type быть не должно
		response += `\r\n`
	}

	return response
}

/**
 * Основной обработчик запросов (Роутер).
 * Принимает распарсенные данные и возвращает сформированный HTTP-ответ.
 */
function handleRequest(method, url, headers, rawBody) {
	// Вспомогательный хелпер для безопасного парсинга JSON
	let bodyJson = null
	if (rawBody && rawBody.trim()) {
		try {
			bodyJson = JSON.parse(rawBody)
		} catch (e) {
			return buildResponse(400, 'Bad Request', {
				error: 'Invalid JSON',
				details: e.message,
			})
		}
	}

	// 1. Маршрут: GET /
	if (url === '/') {
		if (method !== 'GET') {
			return buildResponse(
				405,
				'Method Not Allowed',
				{ error: 'Method Not Allowed' },
				{ Allow: 'GET' },
			)
		}
		return buildResponse(200, 'OK', { service: 'Omnia API', version: '0.1.0' })
	}

	// 2. Маршрут: GET /health
	if (url === '/health') {
		if (method !== 'GET') {
			return buildResponse(
				405,
				'Method Not Allowed',
				{ error: 'Method Not Allowed' },
				{ Allow: 'GET' },
			)
		}
		return buildResponse(200, 'OK', { status: 'ok' })
	}

	// 3. Маршрут: POST /agents
	if (url === '/agents') {
		if (method !== 'POST') {
			return buildResponse(
				405,
				'Method Not Allowed',
				{ error: 'Method Not Allowed' },
				{ Allow: 'POST' },
			)
		}
		if (!bodyJson || Object.keys(bodyJson).length === 0) {
			return buildResponse(400, 'Bad Request', {
				error: 'Request body is required',
			})
		}
		// Эхо тела запроса + заголовок Location
		return buildResponse(
			201,
			'Created',
			{ id: 1, ...bodyJson },
			{ Location: '/agents/1' },
		)
	}

	// 4. Маршрут: DELETE /agents/1
	if (url === '/agents/1') {
		if (method !== 'DELETE') {
			return buildResponse(
				405,
				'Method Not Allowed',
				{ error: 'Method Not Allowed' },
				{ Allow: 'DELETE' },
			)
		}
		// Возвращаем 204 No Content без тела
		return buildResponse(204, 'No Content')
	}

	// 5. Маршрут: GET /agents/999
	if (url === '/agents/999') {
		if (method !== 'GET') {
			return buildResponse(
				405,
				'Method Not Allowed',
				{ error: 'Method Not Allowed' },
				{ Allow: 'GET' },
			)
		}
		return buildResponse(404, 'Not Found', { error: 'Agent not found' })
	}

	// Любой другой URL возвращает 404 Not Found
	return buildResponse(404, 'Not Found', { error: 'Not Found' })
}

const server = net.createServer(socket => {
	socket.on('data', data => {
		try {
			const raw = data.toString()

			// 1. Делим на заголовки и тело
			const [head, ...bodyParts] = raw.split('\r\n\r\n')
			const rawBody = bodyParts.join('\r\n\r\n')

			const lines = head.split('\r\n')
			const firstLine = lines[0]

			if (!firstLine) {
				socket.end()
				return
			}

			// 2. Парсим метод, путь и версию протокола
			const [method, url, protocolVersion] = firstLine.split(' ')

			console.log(`[Request] ${method} ${url} (${protocolVersion})`)

			// 3. Парсим заголовки
			const headers = {}
			for (let i = 1; i < lines.length; i++) {
				const line = lines[i]
				if (!line) continue
				const colonIndex = line.indexOf(':')
				if (colonIndex === -1) continue
				const key = line.slice(0, colonIndex).trim().toLowerCase()
				const value = line.slice(colonIndex + 1).trim()
				headers[key] = value
			}

			// 4. Роутим и получаем ответ
			const response = handleRequest(method, url, headers, rawBody)

			// 5. Записываем ответ в сокет и закрываем соединение
			socket.write(response)
		} catch (error) {
			console.error('Ошибка при обработке запроса:', error)
			// В случае непредвиденного бага сервера возвращаем 500
			const errorResponse = buildResponse(500, 'Internal Server Error', {
				error: 'Internal Server Error',
			})
			socket.write(errorResponse)
		} finally {
			socket.end()
		}
	})
})

server.listen(3000, () => {
	console.log('TCP сервер слушает порт 3000...')
	console.log('Открой в браузере: http://localhost:3000')
})
