import { render } from '@testing-library/react-native';
import ChatInputBox from '../../components/chat/ChatInputBox';

// Mock using plain functions, no JSX in mock factories
jest.mock('../../components/ui/button', () => ({
  Button: jest.fn().mockImplementation(() => null),
}));

jest.mock('../../components/ui/input', () => ({
  Input: jest.fn().mockImplementation(() => null),
}));

jest.mock('../../components/ui/icon-symbol', () => ({
  IconSymbol: jest.fn().mockImplementation(() => null),
}));

jest.mock('../../constants/theme', () => ({
  Colors: { light: { primary: '#2563EB', textSecondary: '#6B7280', surface: '#FFFFFF' } },
  Spacing: { lg: 16, sm: 8 },
}));

describe('ChatInputBox', () => {
  const defaultProps = {
    sending: false,
    useWebSearch: false,
    bottomOffset: 0,
    onToggleWebSearch: jest.fn(),
    onSend: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const { toJSON } = render(<ChatInputBox {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders with web search enabled', () => {
    const { toJSON } = render(<ChatInputBox {...defaultProps} useWebSearch />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders sending state', () => {
    const { toJSON } = render(<ChatInputBox {...defaultProps} sending />);
    expect(toJSON()).toMatchSnapshot();
  });
});
