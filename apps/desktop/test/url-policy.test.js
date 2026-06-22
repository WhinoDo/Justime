const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { isValidAppUrl, canOpenExternalUrl } = require('../src/url-policy')

describe('url-policy', () => {
  describe('isValidAppUrl', () => {
    it('accepts https://justime.example.com', () => {
      assert.equal(isValidAppUrl('https://justime.example.com'), true)
    })

    it('accepts http://localhost:3000', () => {
      assert.equal(isValidAppUrl('http://localhost:3000'), true)
    })

    it('accepts http://127.0.0.1:3000', () => {
      assert.equal(isValidAppUrl('http://127.0.0.1:3000'), true)
    })

    it('accepts http://[::1]:3000', () => {
      assert.equal(isValidAppUrl('http://[::1]:3000'), true)
    })

    it('rejects http://example.com', () => {
      assert.equal(isValidAppUrl('http://example.com'), false)
    })

    it('rejects file:///tmp/index.html', () => {
      assert.equal(isValidAppUrl('file:///tmp/index.html'), false)
    })

    it('rejects javascript:alert(1)', () => {
      assert.equal(isValidAppUrl('javascript:alert(1)'), false)
    })

    it('rejects "not a url"', () => {
      assert.equal(isValidAppUrl('not a url'), false)
    })

    it('rejects undefined', () => {
      assert.equal(isValidAppUrl(undefined), false)
    })
  })

  describe('canOpenExternalUrl', () => {
    it('accepts https://example.com/docs', () => {
      assert.equal(canOpenExternalUrl('https://example.com/docs'), true)
    })

    it('accepts mailto:user@example.com', () => {
      assert.equal(canOpenExternalUrl('mailto:user@example.com'), true)
    })

    it('accepts http://localhost:3000/health', () => {
      assert.equal(canOpenExternalUrl('http://localhost:3000/health'), true)
    })

    it('rejects http://example.com', () => {
      assert.equal(canOpenExternalUrl('http://example.com'), false)
    })

    it('rejects file:///tmp/a', () => {
      assert.equal(canOpenExternalUrl('file:///tmp/a'), false)
    })
  })
})
