import { handler } from './handler'

describe(`Test Template Service handlers executeTaskFooWorker tests`, () => {
  it(`exports the handler function`, () => {
    expect(typeof handler).toBe('function')
  })
})
