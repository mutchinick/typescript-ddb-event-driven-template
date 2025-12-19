import { handler } from './executeTaskQuxWorker'

describe(`Test Template Service handlers executeTaskQuxWorker tests`, () => {
  it(`exports the handler function`, () => {
    expect(typeof handler).toBe('function')
  })
})
