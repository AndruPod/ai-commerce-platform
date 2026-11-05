import { render } from '@testing-library/react';
import { RichText } from './RichText';

describe('RichText', () => {
  it('renders lists and bold but never turns URLs into links', () => {
    const { container } = render(<RichText text={'Intro **bold**\n- one\n- two https://evil.example/pay'} />);
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });
});
