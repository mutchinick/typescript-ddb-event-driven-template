import { handler } from './listJobEventsApi'

// COMBAK: Can mock clients to assert the Controller is built as expected
describe(`Test Template Service handlers listJobEventsApi tests`, () => {
  it(`exports the handler function`, () => {
    expect(typeof handler).toBe('function')
  })
})
