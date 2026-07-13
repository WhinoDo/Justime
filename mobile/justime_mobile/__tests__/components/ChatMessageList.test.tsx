import { render } from '@testing-library/react-native';
import ChatMessageList from '../../components/chat/ChatMessageList';
import type { ChatMessage } from '../../types/chat';

// Mock child components - no JSX in mock factories
jest.mock('../../components/ui/button', () => ({
  Button: jest.fn().mockImplementation(() => null),
}));

jest.mock('../../components/ui/card', () => ({
  Card: jest.fn().mockImplementation(({ children }) => children || null),
}));

jest.mock('../../components/ui/icon-symbol', () => ({
  IconSymbol: jest.fn().mockImplementation(() => null),
}));

jest.mock('../../components/themed-text', () => ({
  ThemedText: jest.fn().mockImplementation(({ children }) => children || null),
}));

jest.mock('../../components/chat/ThinkingBubble', () => ({
  ThinkingBubble: jest.fn().mockImplementation(() => null),
}));

jest.mock('../../components/chat/TaskDecompositionView', () => ({
  TaskDecompositionView: jest.fn().mockImplementation(() => null),
}));

jest.mock('../../constants/theme', () => ({
  Colors: {
    light: {
      secondary: '#8B5CF6', surface: '#FFFFFF', surfaceHighlight: '#F3F4F6',
      primary: '#2563EB', text: '#1F2937', textSecondary: '#6B7280',
      error: '#EF4444', border: '#E5E7EB',
    },
  },
  BorderRadius: { lg: 16 },
  Spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
}));

const createMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `msg-${overrides.role || 'user'}-${Math.random().toString(36).substring(2, 8)}`,
  role: 'user',
  content: 'Test message',
  timestamp: '2026-06-18T01:00:00.000Z',
  ...overrides,
});

describe('ChatMessageList', () => {
  const defaultProps = {
    messages: [],
    sending: false,
    sendingPrompt: '',
    eventActionKey: null,
    activePlanIndexes: {},
    onDismissEvent: jest.fn(),
    onAddEvent: jest.fn(),
    onDismissDecomposition: jest.fn(),
    onAddTask: jest.fn() as jest.Mock,
    onSetActivePlanIndex: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0.123456789);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders empty list', () => {
    const { toJSON } = render(<ChatMessageList {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders user messages', () => {
    const messages = [createMessage({ role: 'user', content: 'Hello' })];
    const { toJSON } = render(<ChatMessageList {...defaultProps} messages={messages} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders assistant messages', () => {
    const messages = [createMessage({ role: 'assistant', content: 'Hi there!' })];
    const { toJSON } = render(<ChatMessageList {...defaultProps} messages={messages} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders multiple messages', () => {
    const messages = [
      createMessage({ role: 'user', content: 'Hello' }),
      createMessage({ role: 'assistant', content: 'Hi!' }),
    ];
    const { toJSON } = render(<ChatMessageList {...defaultProps} messages={messages} />);
    expect(toJSON()).toMatchSnapshot();
  });
});
