import { describe, it, expect } from 'vitest'
import { SELF } from 'cloudflare:test'

describe('Health endpoint', () => {
  it('returns ok status', async () => {
    const response = await SELF.fetch('http://localhost/health')
    expect(response.status).toBe(200)

    const body = (await response.json()) as { status: string; service: string }
    expect(body.status).toBe('ok')
    expect(body.service).toBe('dc-api')
  })
})
