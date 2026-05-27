import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BigCalendar, CalendarEventData } from '../BigCalendar'

jest.mock('react-big-calendar', () => {
  const MockCalendar = ({ events, onSelectEvent, onSelectSlot, onView, view, messages }: any) => (
    <div data-testid="mock-calendar">
      <span data-testid="event-count">{events?.length ?? 0}</span>
      <span data-testid="current-view">{view}</span>
      <button data-testid="select-event-btn" onClick={() => onSelectEvent?.(events?.[0])}>
        Select Event
      </button>
      <button
        data-testid="select-slot-btn"
        onClick={() => onSelectSlot?.({ start: new Date(), end: new Date(), slots: [] })}
      >
        Select Slot
      </button>
      <button data-testid="change-view-btn" onClick={() => onView?.('week')}>
        Change View
      </button>
      <div data-testid="messages">{JSON.stringify(messages)}</div>
      {events?.map((e: any) => (
        <div key={e._id || e.title} data-testid={`event-${e._id || e.title}`}>
          {e.title}
        </div>
      ))}
    </div>
  )
  return {
    __esModule: true,
    Calendar: MockCalendar,
    dateFnsLocalizer: jest.fn(() => ({})),
  }
})

jest.mock('react-big-calendar/lib/css/react-big-calendar.css', () => {})

jest.mock('../CalendarComponents', () => ({
  CustomEvent: ({ event }: any) => <div data-testid="custom-event">{event.title}</div>,
  CustomToolbar: ({ label }: any) => <div data-testid="custom-toolbar">{label}</div>,
  CustomDateHeader: ({ label }: any) => <span data-testid="date-header">{label}</span>,
}))

const sampleEvents: CalendarEventData[] = [
  {
    _id: 'evt-1',
    title: '团队周会',
    start: new Date('2024-06-15T09:00:00'),
    end: new Date('2024-06-15T10:00:00'),
    type: 'meeting',
    priority: 'high',
  },
  {
    _id: 'evt-2',
    title: '写代码',
    start: new Date('2024-06-15T10:00:00'),
    end: new Date('2024-06-15T12:00:00'),
    type: 'task',
    priority: 'medium',
  },
  {
    _id: 'evt-3',
    title: '全天活动',
    start: new Date('2024-06-15T00:00:00'),
    end: new Date('2024-06-15T23:59:00'),
    allDay: true,
    type: 'other',
  },
]

describe('BigCalendar', () => {
  const mockOnSelectEvent = jest.fn()
  const mockOnSelectSlot = jest.fn()
  const mockOnViewChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the calendar component', () => {
    render(<BigCalendar events={sampleEvents} />)
    expect(screen.getByTestId('mock-calendar')).toBeInTheDocument()
  })

  it('passes events to the calendar', () => {
    render(<BigCalendar events={sampleEvents} />)
    expect(screen.getByTestId('event-count')).toHaveTextContent('3')
  })

  it('renders event titles', () => {
    render(<BigCalendar events={sampleEvents} />)
    expect(screen.getByTestId('event-evt-1')).toHaveTextContent('团队周会')
    expect(screen.getByTestId('event-evt-2')).toHaveTextContent('写代码')
    expect(screen.getByTestId('event-evt-3')).toHaveTextContent('全天活动')
  })

  it('defaults to month view', () => {
    render(<BigCalendar events={[]} />)
    expect(screen.getByTestId('current-view')).toHaveTextContent('month')
  })

  it('uses controlled view when provided', () => {
    render(<BigCalendar events={[]} view="week" />)
    expect(screen.getByTestId('current-view')).toHaveTextContent('week')
  })

  it('calls onSelectEvent when an event is selected', async () => {
    const user = userEvent.setup()
    render(<BigCalendar events={sampleEvents} onSelectEvent={mockOnSelectEvent} />)

    await user.click(screen.getByTestId('select-event-btn'))
    expect(mockOnSelectEvent).toHaveBeenCalledWith(sampleEvents[0])
  })

  it('calls onSelectSlot when a time slot is selected', async () => {
    const user = userEvent.setup()
    render(<BigCalendar events={[]} onSelectSlot={mockOnSelectSlot} />)

    await user.click(screen.getByTestId('select-slot-btn'))
    expect(mockOnSelectSlot).toHaveBeenCalledTimes(1)
  })

  it('calls onViewChange when view is changed', async () => {
    const user = userEvent.setup()
    render(<BigCalendar events={[]} onViewChange={mockOnViewChange} />)

    await user.click(screen.getByTestId('change-view-btn'))
    expect(mockOnViewChange).toHaveBeenCalledWith('week')
  })

  it('provides Chinese localization messages', () => {
    render(<BigCalendar events={[]} />)
    const messagesText = screen.getByTestId('messages').textContent
    const messages = JSON.parse(messagesText!)
    expect(messages.today).toBe('今天')
    expect(messages.month).toBe('月')
    expect(messages.week).toBe('周')
    expect(messages.day).toBe('日')
  })

  it('renders with an empty events array', () => {
    render(<BigCalendar events={[]} />)
    expect(screen.getByTestId('event-count')).toHaveTextContent('0')
  })

  it('does not call onSelectEvent when callback is not provided', async () => {
    const user = userEvent.setup()
    render(<BigCalendar events={sampleEvents} />)

    await user.click(screen.getByTestId('select-event-btn'))
    expect(mockOnSelectEvent).not.toHaveBeenCalled()
  })

  it('does not call onSelectSlot when callback is not provided', async () => {
    const user = userEvent.setup()
    render(<BigCalendar events={[]} />)

    await user.click(screen.getByTestId('select-slot-btn'))
    expect(mockOnSelectSlot).not.toHaveBeenCalled()
  })

  it('renders the calendar container with correct class', () => {
    const { container } = render(<BigCalendar events={[]} />)
    expect(container.querySelector('.calendar-theme-glass')).toBeInTheDocument()
  })
})
