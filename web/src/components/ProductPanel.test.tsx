import { render, screen, within } from '@testing-library/react';
import { blockedCheckout, checkoutUnavailable, enrollment, product, schedule } from '@/test/fixtures';
import { ProductPanel } from './ProductPanel';

const RAW_CODES = ['ONLINE_LIVE', 'GROUP_PROGRAM', 'PACKAGE_TOTAL', 'BEGINNER', 'RECREATIONAL', 'ADVANCED', 'PROFESSIONAL', 'UNCONFIRMED', 'PROTOTYPE_CONFIG', 'OPEN', 'SATURDAY', 'NOT_PROVIDED', 'PRICE_CONFLICT', 'CANDIDATE_UNCONFIRMED'];

describe('ProductPanel', () => {
  const renderPanel = () =>
    render(
      <ProductPanel
        data={{ product, schedule, enrollment, checkout: blockedCheckout }}
        loading={false}
        error={null}
        chatCheckoutAction={checkoutUnavailable}
        timezone="Europe/London"
      />,
    );

  it('5. uses friendly labels instead of raw enum values in the primary product UI', () => {
    const { container } = renderPanel();
    const text = container.textContent ?? '';
    for (const code of RAW_CODES) expect(text).not.toMatch(new RegExp(`\\b${code}\\b`));

    expect(screen.getByText('1-Year Online Ballet Club')).toBeInTheDocument();
    expect(screen.getByText(/Online · Live · Group program/)).toBeInTheDocument();
    expect(screen.getByText('1 year')).toBeInTheDocument();
    expect(screen.getByText('48 included')).toBeInTheDocument();
    expect(screen.getByText(/Weekly on Saturdays/)).toBeInTheDocument();
    expect(screen.getByText('60 minutes')).toBeInTheDocument();
    expect(screen.getByText('Emilia')).toBeInTheDocument();
    const audience = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(audience).toEqual(['Beginner', 'Recreational', 'Advanced', 'Professional']);
    expect(screen.getByText('$499 USD')).toBeInTheDocument();
    expect(screen.getByText(/Package total · payment schedule not specified/)).toBeInTheDocument();
    expect(screen.getByText('Not specified in the product information')).toBeInTheDocument();
  });

  it('shows enrollment separately from payment, with a natural-language qualifier', () => {
    renderPanel();
    const enrollmentCard = screen.getByRole('heading', { name: 'Enrollment' }).closest('section')!;
    expect(within(enrollmentCard).getByText(/Shown as open in the prototype; not confirmed by Victory Skating Academy\./)).toBeInTheDocument();
    const paymentCard = screen.getByRole('heading', { name: 'Payment' }).closest('section')!;
    expect(paymentCard).not.toBe(enrollmentCard);
    expect(within(paymentCard).getByRole('button', { name: 'Payment unavailable' })).toBeDisabled();
  });

  it('shows the empty state before any product is known', () => {
    render(<ProductPanel data={undefined} loading={false} error={null} chatCheckoutAction={null} timezone={undefined} />);
    expect(screen.getByText(/structured product data will appear here/)).toBeInTheDocument();
  });
});
