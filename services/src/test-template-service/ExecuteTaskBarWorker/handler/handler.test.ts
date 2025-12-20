import { handler } from './handler'

describe(`Test Template Service handlers executeTaskBarWorker tests`, () => {
  it(`exports the handler function`, () => {
    expect(typeof handler).toBe('function')
  })
})
