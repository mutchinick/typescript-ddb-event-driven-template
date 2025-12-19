import { handler } from './executeTaskBarWorker'

describe(`Test Template Service handlers executeTaskBarWorker tests`, () => {
  it(`exports the handler function`, () => {
    expect(typeof handler).toBe('function')
  })
})
