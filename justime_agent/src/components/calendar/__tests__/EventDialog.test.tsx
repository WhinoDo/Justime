import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventDialog } from '../EventDialog'
import { CalendarEventData } from '../BigCalendar'

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: any) => <a href={href}>{children}</a>
  MockLink.displayName = 'MockLink'
  return MockLink
})

jest.mock('@/lib/api/endpoints', () => ({
  API_ENDPOINTS: {
    CALENDAR: {
      EVENT_YOUTUBE_SUMMARY_JOBS: (eventId: string) =>
        `/api/calendar/events/${eventId}/youtube-summary/jobs`,
      EVENT_YOUTUBE_SUMMARY_JOB: (eventId: string, jobId: string) =>
        `/api/calendar/events/${eventId}/youtube-summary/jobs/${jobId}`,
    },
  },
}))

const mockOnOpenChange = jest.fn()
const mockOnSave = jest.fn()
const mockOnDelete = jest.fn()

const defaultStart = new Date('2024-06-15T09:00:00')
const defaultEnd = new Date('2024-06-15T10:00:00')

const sampleEvent: CalendarEventData = {
  _id: 'evt-1',
  title: '团队周会',
  start: new Date('2024-06-15T09:00:00'),
  end: new Date('2024-06-15T10:00:00'),
  allDay: false,
  description: '讨论本周进展',
  type: 'meeting',
  priority: 'high',
  location: '3号会议室',
  color: '#8b5cf6',
  resources: [],
}

function renderDialog(overrides: Partial<Parameters<typeof EventDialog>[0]> = {}) {
  return render(
    <EventDialog
      open={true}
      onOpenChange={mockOnOpenChange}
      onSave={mockOnSave}
      onDelete={mockOnDelete}
      defaultStart={defaultStart}
      defaultEnd={defaultEnd}
      {...overrides}
    />
  )
}

describe('EventDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders create mode when no event is provided', () => {
    renderDialog()
    expect(screen.getByText('创建新事件')).toBeInTheDocument()
    expect(screen.getByText('填写事件详情')).toBeInTheDocument()
  })

  it('renders edit mode when event is provided', () => {
    renderDialog({ event: sampleEvent })
    expect(screen.getByText('编辑事件')).toBeInTheDocument()
    expect(screen.getByText('修改事件信息')).toBeInTheDocument()
  })

  it('populates form fields from event in edit mode', () => {
    renderDialog({ event: sampleEvent })
    expect(screen.getByDisplayValue('团队周会')).toBeInTheDocument()
    expect(screen.getByDisplayValue('3号会议室')).toBeInTheDocument()
    expect(screen.getByDisplayValue('讨论本周进展')).toBeInTheDocument()
  })

  it('populates form fields from defaultStart/defaultEnd in create mode', () => {
    renderDialog()
    expect(screen.getByText('创建新事件')).toBeInTheDocument()
    expect(screen.getByLabelText(/开始时间/)).toHaveValue('2024-06-15T09:00')
    expect(screen.getByLabelText(/结束时间/)).toHaveValue('2024-06-15T10:00')
  })

  it('calls onOpenChange(false) when cancel button is clicked', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onSave with form data on submit', async () => {
    mockOnSave.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderDialog()

    const titleInput = screen.getByLabelText(/标题/)
    await user.clear(titleInput)
    await user.type(titleInput, '新事件')

    const submitButton = screen.getByRole('button', { name: '保存' })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1)
    })

    const savedData = mockOnSave.mock.calls[0][0]
    expect(savedData.title).toBe('新事件')
    expect(savedData.start).toBeInstanceOf(Date)
    expect(savedData.end).toBeInstanceOf(Date)
  })

  it('shows loading state while saving', async () => {
    let resolveSave: () => void
    mockOnSave.mockReturnValue(new Promise<void>((resolve) => { resolveSave = resolve }))

    const user = userEvent.setup()
    renderDialog()

    const titleInput = screen.getByLabelText(/标题/)
    await user.clear(titleInput)
    await user.type(titleInput, 'Loading Test')

    const submitButton = screen.getByRole('button', { name: '保存' })
    await user.click(submitButton)

    expect(screen.getByText('保存中...')).toBeInTheDocument()

    resolveSave!()
    await waitFor(() => {
      expect(screen.queryByText('保存中...')).not.toBeInTheDocument()
    })
  })

  it('shows delete button only in edit mode with onDelete', () => {
    renderDialog({ event: sampleEvent, onDelete: mockOnDelete })
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument()
  })

  it('hides delete button when no onDelete is provided', () => {
    renderDialog({ event: sampleEvent, onDelete: undefined })
    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument()
  })

  it('hides delete button when creating a new event', () => {
    renderDialog({ onDelete: mockOnDelete })
    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument()
  })

  it('calls onDelete when delete is confirmed', async () => {
    mockOnDelete.mockResolvedValue(undefined)
    jest.spyOn(window, 'confirm').mockReturnValue(true)

    const user = userEvent.setup()
    renderDialog({ event: sampleEvent, onDelete: mockOnDelete })

    await user.click(screen.getByRole('button', { name: '删除' }))

    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalledWith('evt-1')
    })

    jest.restoreAllMocks()
  })

  it('does not call onDelete when delete is cancelled', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false)

    const user = userEvent.setup()
    renderDialog({ event: sampleEvent, onDelete: mockOnDelete })

    await user.click(screen.getByRole('button', { name: '删除' }))
    expect(mockOnDelete).not.toHaveBeenCalled()

    jest.restoreAllMocks()
  })

  it('allows typing in the title field', async () => {
    const user = userEvent.setup()
    renderDialog()

    const titleInput = screen.getByLabelText(/标题/)
    await user.type(titleInput, 'Test Event Title')
    expect(titleInput).toHaveValue('Test Event Title')
  })

  it('allows typing in the location field', async () => {
    const user = userEvent.setup()
    renderDialog()

    const locationInput = screen.getByLabelText(/地点/)
    await user.type(locationInput, '5号会议室')
    expect(locationInput).toHaveValue('5号会议室')
  })

  it('allows typing in the description field', async () => {
    const user = userEvent.setup()
    renderDialog()

    const descInput = screen.getByLabelText(/描述/)
    await user.type(descInput, '这是一段描述')
    expect(descInput).toHaveValue('这是一段描述')
  })

  it('shows "暂无资源" when there are no resources', () => {
    renderDialog()
    expect(screen.getByText('暂无资源')).toBeInTheDocument()
  })

  it('adds a resource when add resource button is clicked', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByText('添加资源'))
    expect(screen.getByPlaceholderText('资源名称')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/URL 链接/)).toBeInTheDocument()
  })

  it('shows YouTube summary button only when event has an _id', () => {
    renderDialog({ event: sampleEvent })
    expect(screen.getByText('解析全部 YouTube 资源')).toBeInTheDocument()
  })

  it('hides YouTube summary button when creating new event', () => {
    renderDialog()
    expect(screen.queryByText('解析全部 YouTube 资源')).not.toBeInTheDocument()
  })

  it('shows "编写工作文档" link when editing event with _id', () => {
    renderDialog({ event: sampleEvent })
    expect(screen.getByText('编写工作文档')).toBeInTheDocument()
  })

  it('renders the color input with default value', () => {
    renderDialog()
    const colorInput = screen.getByLabelText(/颜色/)
    expect(colorInput).toHaveValue('#3b82f6')
  })

  it('renders with event color in edit mode', () => {
    renderDialog({ event: sampleEvent })
    const colorInput = screen.getByLabelText(/颜色/)
    expect(colorInput).toHaveValue('#8b5cf6')
  })

  it('disables save button while loading', async () => {
    let resolveSave: () => void
    mockOnSave.mockReturnValue(new Promise<void>((resolve) => { resolveSave = resolve }))

    const user = userEvent.setup()
    renderDialog()

    const titleInput = screen.getByLabelText(/标题/)
    await user.type(titleInput, 'X')

    const submitButton = screen.getByRole('button', { name: '保存' })
    await user.click(submitButton)

    expect(screen.getByRole('button', { name: '保存中...' })).toBeDisabled()

    resolveSave!()
  })

  it('calls onOpenChange(false) after successful save', async () => {
    mockOnSave.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderDialog()

    const titleInput = screen.getByLabelText(/标题/)
    await user.type(titleInput, 'Test')

    const submitButton = screen.getByRole('button', { name: '保存' })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })
})
