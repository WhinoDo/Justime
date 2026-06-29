import React from 'react'
import { render } from '@testing-library/react'
import { JustimePageShell } from '../JustimePageShell'

jest.mock('@/components/ui/JustimeBackground', () => ({
  JustimeBackground: () => <div data-testid="justime-background" />,
}))

describe('JustimePageShell', () => {
  describe('fullHeight viewport contract', () => {
    it('applies jushi-app class when fullHeight is true', () => {
      const { container } = render(
        <JustimePageShell fullHeight>
          <p>content</p>
        </JustimePageShell>
      )

      const outer = container.firstElementChild as HTMLElement
      expect(outer.className).toContain('jushi-app')
      expect(outer.className).not.toContain('h-screen')
    })

    it('applies local-scroll to content wrapper when fullHeight is true', () => {
      const { container } = render(
        <JustimePageShell fullHeight>
          <p>content</p>
        </JustimePageShell>
      )

      const outer = container.firstElementChild as HTMLElement
      const content = outer.children[1] as HTMLElement
      expect(content.className).toContain('local-scroll')
      expect(content.className).toContain('h-full')
    })

    it('preserves min-h-screen when fullHeight is false', () => {
      const { container } = render(
        <JustimePageShell>
          <p>content</p>
        </JustimePageShell>
      )

      const outer = container.firstElementChild as HTMLElement
      expect(outer.className).toContain('min-h-screen')
      expect(outer.className).not.toContain('jushi-app')
    })

    it('preserves min-h-screen on content wrapper when fullHeight is false', () => {
      const { container } = render(
        <JustimePageShell>
          <p>content</p>
        </JustimePageShell>
      )

      const outer = container.firstElementChild as HTMLElement
      const content = outer.children[1] as HTMLElement
      expect(content.className).toContain('min-h-screen')
      expect(content.className).not.toContain('local-scroll')
    })
  })

  describe('className passthrough', () => {
    it('merges custom className on outer wrapper', () => {
      const { container } = render(
        <JustimePageShell className="custom-outer">
          <p>content</p>
        </JustimePageShell>
      )

      const outer = container.firstElementChild as HTMLElement
      expect(outer.className).toContain('custom-outer')
    })

    it('merges custom contentClassName on inner wrapper', () => {
      const { container } = render(
        <JustimePageShell contentClassName="custom-inner">
          <p>content</p>
        </JustimePageShell>
      )

      const outer = container.firstElementChild as HTMLElement
      const content = outer.children[1] as HTMLElement
      expect(content.className).toContain('custom-inner')
    })
  })

  describe('desktop variant', () => {
    it('adds desktop background classes when variant is desktop', () => {
      const { container } = render(
        <JustimePageShell variant="desktop">
          <p>content</p>
        </JustimePageShell>
      )

      const outer = container.firstElementChild as HTMLElement
      expect(outer.className).toContain('bg-[#fbfaff]')
      expect(outer.className).toContain('text-[#171421]')
    })

    it('adds desktop-titlebar-safe on content wrapper when variant is desktop', () => {
      const { container } = render(
        <JustimePageShell variant="desktop">
          <p>content</p>
        </JustimePageShell>
      )

      const outer = container.firstElementChild as HTMLElement
      const content = outer.children[1] as HTMLElement
      expect(content.className).toContain('desktop-titlebar-safe')
    })

    it('does not add desktop classes when variant is immersive', () => {
      const { container } = render(
        <JustimePageShell variant="immersive">
          <p>content</p>
        </JustimePageShell>
      )

      const outer = container.firstElementChild as HTMLElement
      expect(outer.className).not.toContain('bg-[#fbfaff]')
    })
  })

  describe('rendering', () => {
    it('renders children', () => {
      const { getByText } = render(
        <JustimePageShell>
          <p>hello world</p>
        </JustimePageShell>
      )

      expect(getByText('hello world')).toBeInTheDocument()
    })

    it('renders JustimeBackground', () => {
      const { getByTestId } = render(
        <JustimePageShell>
          <p>content</p>
        </JustimePageShell>
      )

      expect(getByTestId('justime-background')).toBeInTheDocument()
    })
  })
})
