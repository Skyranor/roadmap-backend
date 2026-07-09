import { describe, it, expect, beforeEach } from 'vitest'
import { Router } from './router.js'

describe('Router Class', () => {
	let router: Router

	// Перед каждым тестом создаем новый инстанс роутера,
	// чтобы тесты были изолированы друг от друга и не влияли на общее состояние.
	beforeEach(() => {
		router = new Router()
	})

	it('должен находить статичные пути (без параметров)', () => {
		const handler = (): void => {}
		router.get('/users', handler)

		const result = router.match('GET', '/users')

		// match не должен возвращать null
		expect(result).not.toBeNull()
		// handler должен совпадать с тем, что мы зарегистрировали
		expect(result?.handler).toBe(handler)
		// параметров быть не должно
		expect(result?.params).toEqual({})
	})

	it('должен правильно извлекать один параметр пути', () => {
		const handler = (): void => {}
		router.get('/users/:id', handler)

		const result = router.match('GET', '/users/42')

		expect(result).not.toBeNull()
		expect(result?.handler).toBe(handler)
		// Проверяем, что в params вернулась пара id: '42'
		expect(result?.params).toEqual({ id: '42' })
	})

	it('должен правильно извлекать несколько параметров пути', () => {
		const handler = (): void => {}
		router.get('/users/:userId/posts/:postId', handler)

		const result = router.match('GET', '/users/abc/posts/100')

		expect(result).not.toBeNull()
		expect(result?.params).toEqual({
			userId: 'abc',
			postId: '100',
		})
	})

	it('должен игнорировать query-параметры при сопоставлении', () => {
		const handler = (): void => {}
		router.get('/users/:id', handler)

		// Отправляем запрос с ?foo=bar
		const result = router.match('GET', '/users/42?foo=bar&baz=1')

		expect(result).not.toBeNull()
		expect(result?.params).toEqual({ id: '42' })
	})

	it('должен возвращать null, если методы не совпадают', () => {
		const handler = (): void => {}
		router.get('/users', handler)

		// Регистрировали GET, а стучимся через POST
		const result = router.match('POST', '/users')

		expect(result).toBeNull()
	})

	it('должен возвращать null, если путь вообще не совпадает', () => {
		router.get('/users', (): void => {})
		
		const result = router.match('GET', '/not-found')

		expect(result).toBeNull()
	})

	it('не должен спотыкаться на спецсимволах регулярных выражений (экранирование)', () => {
		const handler = (): void => {}
		// Точка в RegExp означает "любой символ". Но тут она должна быть просто точкой.
		router.get('/api/v1.0/users', handler)

		// Правильный запрос
		const okResult = router.match('GET', '/api/v1.0/users')
		expect(okResult).not.toBeNull()

		// Неправильный запрос (если точка не экранирована, /api/v1-0/users совпадёт)
		const badResult = router.match('GET', '/api/v1-0/users')
		expect(badResult).toBeNull()
	})
})
