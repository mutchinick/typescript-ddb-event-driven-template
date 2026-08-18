import { handler } from './handler'

// COMBAK: Can mock clients to assert the Controller is built as expected
describe(`Test Template Service handlers recordFinalizedJobWorker tests`, () => {
  it(`exports the handler function`, () => {
    expect(typeof handler).toBe('function')
  })
})
