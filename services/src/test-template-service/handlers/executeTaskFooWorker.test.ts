import { handler } from './executeTaskFooWorker'

describe(`Test Template Service handlers executeTaskFooWorker tests`, () => {
  it(`exports the handler function`, () => {
    expect(typeof handler).toBe('function')
  })
})
