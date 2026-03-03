import { Hono } from 'hono'
import type { Env } from '../types/index.js'

const health = new Hono<{ Bindings: Env }>()

health.get('/', (c) => {
  return c.json({ status: 'ok', service: 'dc-api' })
})

export { health }
