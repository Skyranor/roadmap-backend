// ============================================================
// НЕДЕЛЯ 2 · Задание 5 (🟢 ПО ОСТАТКУ)
// Worker Threads Benchmarking
//
// Запуск: npx tsx src/week2/worker-bench.ts
// ============================================================

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { cpus } from 'node:os'

interface WorkerTask {
	start: number
	end: number
}

/**
 * CPU-bound задача: сумма тригонометрических вычислений от start до end.
 */
function heavyComputation(start: number, end: number): number {
	let sum = 0
	for (let i = start; i < end; i++) {
		sum += Math.sin(i) * Math.cos(i)
	}
	return sum
}

const ITERATIONS = 100_000_000

// ============================================================
// Worker-код (выполняется в отдельном потоке)
// ============================================================
if (!isMainThread) {
	const task = workerData as WorkerTask
	const result = heavyComputation(task.start, task.end)
	parentPort!.postMessage(result)
}

// ============================================================
// Main thread
// ============================================================
if (isMainThread && import.meta.url === `file://${process.argv[1]}`) {
	console.log(`CPU cores: ${cpus().length}`)
	console.log(`Task: sum of Math.sin(i) * Math.cos(i) from 0..${ITERATIONS.toLocaleString()}\n`)

	// --- Бенчмарк 1: Main Thread ---
	console.log('⏱  Main thread (blocking)...')
	const startMain = process.hrtime.bigint()

	const result = heavyComputation(0, ITERATIONS)

	const endMain = process.hrtime.bigint()
	const mainMs = Number(endMain - startMain) / 1_000_000
	console.log(`   Результат: ${result}`)
	console.log(`   Время: ${mainMs.toFixed(1)} ms\n`)

	// --- Бенчмарк 2: Worker Threads ---
	const NUM_WORKERS = cpus().length
	console.log(`⏱  ${NUM_WORKERS} Worker threads (parallel)...`)
	const startWorkers = process.hrtime.bigint()

	const chunkSize = Math.floor(ITERATIONS / NUM_WORKERS)
	const promises: Promise<number>[] = []

	for (let i = 0; i < NUM_WORKERS; i++) {
		const start = i * chunkSize
		const end = i === NUM_WORKERS - 1 ? ITERATIONS : (i + 1) * chunkSize

		const promise = new Promise<number>((resolve, reject) => {
			const worker = new Worker(new URL(import.meta.url), {
				workerData: { start, end } satisfies WorkerTask,
			})
			worker.on('message', resolve)
			worker.on('error', reject)
			worker.on('exit', code => {
				if (code !== 0) {
					reject(new Error(`Worker stopped with exit code ${code}`))
				}
			})
		})
		promises.push(promise)
	}

	const results = await Promise.all(promises)
	const workersResult = results.reduce((acc, val) => acc + val, 0)

	const endWorkers = process.hrtime.bigint()
	const workerMs = Number(endWorkers - startWorkers) / 1_000_000
	console.log(`   Результат: ${workersResult}`)
	console.log(`   Время: ${workerMs.toFixed(1)} ms\n`)

	console.log(`📊 Speedup: ${(mainMs / workerMs).toFixed(1)}x`)

	// Валидация: результаты main thread и workers должны совпадать с учетом погрешности float
	const diff = Math.abs(result - workersResult)
	if (diff > 1e-3) {
		console.error(`❌ Результаты не совпадают! Main: ${result}, Workers: ${workersResult}`)
		process.exit(1)
	} else {
		console.log('✅ Результаты совпадают')
	}
}
