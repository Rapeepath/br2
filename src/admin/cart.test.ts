import { cartReducer, emptyCart, itemCount, quickTenders, toCheckout, toLines, type Cart } from './cart'

const add = (cart: Cart, productId: string, max: number | null = null) => cartReducer(cart, { type: 'add', productId, max })

describe('cart', () => {
  it('adds a product once and counts repeats as quantity', () => {
    let c = add(emptyCart, 'robot')
    c = add(c, 'robot')
    c = add(c, 'svc')
    expect(c.lines).toEqual([
      { productId: 'robot', qty: 2, discount: 0 },
      { productId: 'svc', qty: 1, discount: 0 },
    ])
    expect(itemCount(c)).toBe(3)
  })

  it('never puts more in the bill than is in stock', () => {
    let c = add(emptyCart, 'g1', 2)
    c = add(c, 'g1', 2)
    c = add(c, 'g1', 2)
    expect(c.lines[0].qty).toBe(2)
    expect(add(emptyCart, 'out', 0).lines).toEqual([])
    c = cartReducer(c, { type: 'qty', productId: 'g1', qty: 9, max: 2 })
    expect(c.lines[0].qty).toBe(2)
  })

  it('keeps quantities whole and at least one, and removes lines', () => {
    let c = add(emptyCart, 'a')
    c = cartReducer(c, { type: 'qty', productId: 'a', qty: 0, max: null })
    expect(c.lines[0].qty).toBe(1)
    c = cartReducer(c, { type: 'qty', productId: 'a', qty: 3.7, max: null })
    expect(c.lines[0].qty).toBe(3)
    c = cartReducer(c, { type: 'remove', productId: 'a' })
    expect(c.lines).toEqual([])
  })

  it('cleans discounts and sends only real ones to the server', () => {
    let c = add(add(emptyCart, 'a'), 'b')
    c = cartReducer(c, { type: 'discount', productId: 'a', discount: 150.555 })
    c = cartReducer(c, { type: 'discount', productId: 'b', discount: -5 })
    expect(toLines(c)).toEqual([{ productId: 'a', qty: 1, discount: 150.56 }, { productId: 'b', qty: 1 }])
    c = cartReducer(c, { type: 'billDiscount', discount: { type: 'percent', value: 5 } })
    c = cartReducer(c, { type: 'customer', customerId: 'c00001' })
    c = cartReducer(c, { type: 'note', note: '  ส่งของวันศุกร์ ' })
    expect(toCheckout(c, { method: 'card', cardLast4: '4242' })).toEqual({
      lines: toLines(c),
      billDiscount: { type: 'percent', value: 5 },
      customerId: 'c00001',
      payment: { method: 'card', cardLast4: '4242' },
      note: 'ส่งของวันศุกร์',
    })
    expect(toCheckout(cartReducer(c, { type: 'clear' }), { method: 'cash' }).billDiscount).toBeUndefined()
  })

  it('offers cash amounts that fit the size of the bill', () => {
    expect(quickTenders(345)).toEqual([345, 400, 500, 1000])
    expect(quickTenders(1000)).toEqual([1000, 5000])
    expect(quickTenders(6500)).toEqual([6500, 7000, 10000])
    expect(quickTenders(456_000)).toEqual([456_000, 460_000, 500_000])
  })
})
