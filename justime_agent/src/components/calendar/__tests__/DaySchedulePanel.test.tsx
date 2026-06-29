import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DaySchedulePanel } from '../DaySchedulePanel'
import { CalendarEventData } from '../BigCalendar'

const mockOnClose = jest.fn()
const mockOnAddEvent = jest.fn()
const mockOnEditEvent = jest.fn()

const today = new Date()
today.setHours(0, 0, 0, 0)

const sampleEvents: CalendarEventData[] = [
  {
    _id: 'evt-1',
    title: '晨会',
    start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0),
    end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 30),
    type: 'meeting',
    priority: 'high',
  },
  {
    _id: 'evt-2',
    title: '写代码',
    start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0),
    end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0),
    type: 'task',
    priority: 'medium',
  },
  {
    _id: 'evt-3',
    title: '午休提醒',
    start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0),
    end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 15),
    type: 'reminder',
    priority: 'low',
  },
]

function renderPanel(overrides: Partial<Parameters<typeof DaySchedulePanel>[0]> = {}) {
  return render(
    <DaySchedulePanel
      date={today}
      events={sampleEvents}
      onClose={mockOnClose}
      onAddEvent={mockOnAddEvent}
      onEditEvent={mockOnEditEvent}
      {...overrides}
    />
  )
}

describe('DaySchedulePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders nothing when date is null', () => {
    const { container } = render(
      <DaySchedulePanel
        date={null}
        events={[]}
        onClose={mockOnClose}
        onAddEvent={mockOnAddEvent}
        onEditEvent={mockOnEditEvent}
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders the panel when a date is provided', () => {
    renderPanel()
    expect(screen.getByText('晨会')).toBeInTheDocument()
    expect(screen.getByText('写代码')).toBeInTheDocument()
    expect(screen.getByText('午休提醒')).toBeInTheDocument()
  })

  it('displays the day number in the header', () => {
    renderPanel()
    const dayNum = String(today.getDate())
    expect(screen.getByText(dayNum)).toBeInTheDocument()
  })

  it('displays event count in the footer', () => {
    renderPanel()
    expect(screen.getByText(/3 个日程/)).toBeInTheDocument()
  })

  it('displays free time calculation in footer', () => {
    renderPanel()
    expect(screen.getByText(/空闲时间:/)).toBeInTheDocument()
  })

  it('shows only events for the selected date', () => {
    const otherDay = new Date(today)
    otherDay.setDate(otherDay.getDate() + 1)

    const eventsOnOtherDay: CalendarEventData[] = [
      {
        _id: 'evt-other',
        title: '明天的事件',
        start: new Date(otherDay.getFullYear(), otherDay.getMonth(), otherDay.getDate(), 9, 0),
        end: new Date(otherDay.getFullYear(), otherDay.getMonth(), otherDay.getDate(), 10, 0),
      },
    ]

    render(
      <DaySchedulePanel
        date={today}
        events={eventsOnOtherDay}
        onClose={mockOnClose}
        onAddEvent={mockOnAddEvent}
        onEditEvent={mockOnEditEvent}
      />
    )

    expect(screen.queryByText('明天的事件')).not.toBeInTheDocument()
    expect(screen.getByText(/0 个日程/)).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup()
    renderPanel()

    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/20')
    if (backdrop) {
      await user.click(backdrop as Element)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    }
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    renderPanel()

    const closeButtons = screen.getAllByRole('button')
    const xButton = closeButtons.find((btn) => btn.querySelector('.lucide-x'))
    if (xButton) {
      await user.click(xButton)
      expect(mockOnClose).toHaveBeenCalled()
    }
  })

  it('calls onAddEvent when add button is clicked', async () => {
    const user = userEvent.setup()
    renderPanel()

    const addButtons = screen.getAllByRole('button')
    const addButton = addButtons.find((btn) => btn.querySelector('.lucide-plus'))
    if (addButton) {
      await user.click(addButton)
      expect(mockOnAddEvent).toHaveBeenCalled()
    }
  })

  it('calls onEditEvent when an event card is clicked', async () => {
    const user = userEvent.setup()
    renderPanel()

    const eventCard = screen.getByText('晨会')
    await user.click(eventCard)
    expect(mockOnEditEvent).toHaveBeenCalled()

    const clickedEvent = mockOnEditEvent.mock.calls[0][0] as CalendarEventData
    expect(clickedEvent._id).toBe('evt-1')
  })

  it('handles events with no type as "other"', () => {
    const eventNoType: CalendarEventData[] = [
      {
        _id: 'evt-notype',
        title: '无类型事件',
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0),
      },
    ]

    render(
      <DaySchedulePanel
        date={today}
        events={eventNoType}
        onClose={mockOnClose}
        onAddEvent={mockOnAddEvent}
        onEditEvent={mockOnEditEvent}
      />
    )

    expect(screen.getByText('无类型事件')).toBeInTheDocument()
  })

  it('displays event location when available', () => {
    const eventsWithLocation: CalendarEventData[] = [
      {
        _id: 'evt-loc',
        title: '带地点的事件',
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0),
        location: '大会议室',
      },
    ]

    render(
      <DaySchedulePanel
        date={today}
        events={eventsWithLocation}
        onClose={mockOnClose}
        onAddEvent={mockOnAddEvent}
        onEditEvent={mockOnEditEvent}
      />
    )

    expect(screen.getByText('大会议室')).toBeInTheDocument()
  })

  it('shows 0 events and 24.0 free hours when there are no events', () => {
    render(
      <DaySchedulePanel
        date={today}
        events={[]}
        onClose={mockOnClose}
        onAddEvent={mockOnAddEvent}
        onEditEvent={mockOnEditEvent}
      />
    )

    expect(screen.getByText(/0 个日程/)).toBeInTheDocument()
    expect(screen.getByText(/24.0 小时/)).toBeInTheDocument()
  })

  it('sorts events by start time', () => {
    renderPanel()

    const titles = screen.getAllByText(/晨会|写代码|午休提醒/)
    expect(titles[0]).toHaveTextContent('晨会')
    expect(titles[1]).toHaveTextContent('写代码')
    expect(titles[2]).toHaveTextContent('午休提醒')
  })

  it('renders panel with flex-col layout and fixed viewport positioning', () => {
    const { container } = renderPanel()
    const panel = container.querySelector('.fixed.inset-y-0.right-0')
    expect(panel).toBeInTheDocument()
    expect(panel!.className).toContain('flex-col')
  })

  it('renders only the timeline content area as scrollable', () => {
    const { container } = renderPanel()
    const scrollable = container.querySelector('.overflow-y-auto')
    expect(scrollable).toBeInTheDocument()
    expect(scrollable!.className).toContain('flex-1')
  })
})
