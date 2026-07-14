// ============================================================
// НЕДЕЛЯ 2 · Задание 3 (🟡 NICE TO HAVE)
// Собственный EventEmitter с нуля
//
// Запуск: npx tsx src/week2/event-emitter.ts
// ============================================================

type Listener = (...args: unknown[]) => void

interface WrappedListener extends Listener {
	listener?: Listener
}

class MyEventEmitter {
	private listeners = new Map<string, WrappedListener[]>()

	/**
	 * Подписаться на событие.
	 */
	on(event: string, listener: Listener): this {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, [])
		}
		this.listeners.get(event)?.push(listener)
		return this
	}

	/**
	 * Отписаться от события.
	 */
	off(event: string, listener: Listener): this {
		const listeners = this.listeners.get(event)
		if (!listeners) {
			return this
		}
		const filtered = listeners.filter(
			l => l !== listener && l.listener !== listener,
		)
		if (filtered.length === 0) {
			this.listeners.delete(event)
		} else {
			this.listeners.set(event, filtered)
		}
		return this
	}

	/**
	 * Вызвать все слушатели события.
	 * ⚠ СИНХРОННО — блокирует, пока все не отработают!
	 */
	emit(event: string, ...args: unknown[]): boolean {
		const listeners = this.listeners.get(event)
		if (!listeners || listeners.length === 0) {
			return false
		}
		// Делаем копию массива, чтобы защититься от мутации списка во время вызова коллбеков
		const copy = [...listeners]
		for (const listener of copy) {
			listener(...args)
		}
		return true
	}

	/**
	 * Подписаться ОДИН раз.
	 */
	once(event: string, listener: Listener): this {
		const wrapper: WrappedListener = (...args: unknown[]) => {
			// Отписываемся до вызова, чтобы избежать бесконечной рекурсии при повторном emit
			this.off(event, wrapper)
			listener(...args)
		}
		// Сохраняем ссылку на оригинальный коллбек для ручной отписки через off()
		wrapper.listener = listener
		this.on(event, wrapper)
		return this
	}

	/**
	 * Количество слушателей для события.
	 */
	listenerCount(event: string): number {
		return this.listeners.get(event)?.length ?? 0
	}
}

export { MyEventEmitter }

// ============================================================
// Тесты
// ============================================================
if (import.meta.url === `file://${process.argv[1]}`) {
	const emitter = new MyEventEmitter()

	console.log('--- Тест 1: on + emit ---')
	emitter.on('greet', name => console.log(`Hello, ${name}!`))
	emitter.on('greet', name => console.log(`Привет, ${name}!`))
	emitter.emit('greet', 'Dzmitry')
	// Ожидается:
	// Hello, Dzmitry!
	// Привет, Dzmitry!

	console.log('\n--- Тест 2: once ---')
	emitter.once('connect', () => console.log('Connected!'))
	emitter.emit('connect') // Connected!
	emitter.emit('connect') // (тишина)

	console.log('\n--- Тест 3: off ---')
	const handler = (): void => console.log('Я подписан')
	emitter.on('test', handler)
	emitter.emit('test') // Я подписан
	emitter.off('test', handler)
	emitter.emit('test') // (тишина)

	console.log('\n--- Тест 4: listenerCount ---')
	const e2 = new MyEventEmitter()
	e2.on('data', () => {})
	e2.on('data', () => {})
	e2.on('error', () => {})
	console.log('data listeners:', e2.listenerCount('data')) // 2
	console.log('error listeners:', e2.listenerCount('error')) // 1
	console.log('foo listeners:', e2.listenerCount('foo')) // 0

	console.log('\n--- Тест 5: emit возвращает boolean ---')
	const e3 = new MyEventEmitter()
	console.log('has listeners:', e3.emit('nope')) // false
	e3.on('yep', () => {})
	console.log('has listeners:', e3.emit('yep')) // true

	console.log('\n--- Тест 6: ручная отписка от once ---')
	const e4 = new MyEventEmitter()
	const onceHandler = () => console.log('ОШИБКА: этот лог не должен появиться!')
	e4.once('temp', onceHandler)
	e4.off('temp', onceHandler)
	e4.emit('temp') // Должна быть тишина

	console.log('\n--- Тест 7: рекурсивный emit в once ---')
	const e5 = new MyEventEmitter()
	let callCount = 0
	e5.once('recursive', () => {
		callCount++
		if (callCount < 3) {
			e5.emit('recursive')
		}
	})
	e5.emit('recursive')
	console.log('Call count (should be 1):', callCount)

	console.log('\n✅ Все тесты пройдены, если вывод совпадает с ожидаемым')
}
