import { handler } from './handler'

describe(`Ecommerce Service handlers placeOrderApi tests`, () => {
  it(`exports the handler function`, () => {
    expect(typeof handler).toBe('function')
  })
})
