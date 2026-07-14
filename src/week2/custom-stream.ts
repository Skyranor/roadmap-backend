// ============================================================
// НЕДЕЛЯ 2 · Задание 4 (🟡 NICE TO HAVE)
// Кастомный Readable Stream
//
// Запуск: npx tsx src/week2/custom-stream.ts
// ============================================================

import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'

/**
 * Задание A: NumberStream
 * Readable Stream, генерирующий числа от 1 до max.
 */
class NumberStream extends Readable {
	private current = 1
	private readonly max: number

	constructor(max = 10) {
		super({ encoding: 'utf-8' })
		this.max = max
	}

	override _read(): void {
		if (this.current <= this.max) {
			this.push(String(this.current++))
		} else {
			this.push(null)
		}
	}
}

/**
 * Задание B (бонус): UpperCaseTransform
 */
class UpperCaseTransform extends Transform {
	override _transform(
		chunk: Buffer,
		_encoding: BufferEncoding,
		callback: (error: Error | null, data?: string) => void,
	): void {
		callback(null, chunk.toString().toUpperCase())
	}
}

export { NumberStream, UpperCaseTransform }

// ============================================================
// Тесты
// ============================================================
if (import.meta.url === `file://${process.argv[1]}`) {
	console.log('--- Тест 1: NumberStream → console ---')
	const nums = new NumberStream(5)
	for await (const chunk of nums) {
		process.stdout.write(chunk as string)
	}

	console.log('\n--- Тест 2: NumberStream → UpperCase → файл ---')
	try {
		await pipeline(new NumberStream(20), new UpperCaseTransform(), createWriteStream('numbers.txt'))
		console.log('✅ Файл numbers.txt создан')
	} catch (err) {
		console.error('❌ Pipeline error:', (err as Error).message)
	}

	console.log('\n--- Тест 3: Большой поток (backpressure) ---')
	const bigStream = new NumberStream(100_000)
	let count = 0
	for await (const _chunk of bigStream) {
		count++
	}
	console.log(`Получено ${count} чанков (должно быть 100000)`)

	console.log('\n--- Тест 4: Визуализация медленного стрима ---')
	class SlowNumberStream extends Readable {
		private current = 1
		private max = 10

		constructor() {
			super({ encoding: 'utf-8' })
		}

		override _read(): void {
			if (this.current <= this.max) {
				setTimeout(() => {
					this.push(`[Чанк #${this.current++}] `)
				}, 300)
			} else {
				this.push(null)
			}
		}
	}

	console.log('🎬 Запуск медленного стрима...')
	const slowStream = new SlowNumberStream()
	slowStream.pipe(process.stdout)

	await new Promise<void>(resolve => {
		slowStream.on('end', () => {
			console.log('\n🏁 Стрим полностью прочитан!')
			resolve()
		})
	})
}
