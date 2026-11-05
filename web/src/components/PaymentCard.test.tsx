import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BLOCKED_URL, blockedCheckout, checkoutUnavailable, product } from '@/test/fixtures';
import { PaymentCard } from './PaymentCard';

const blocked = blockedCheckout.actions[0];
const offer = product.offers[0];

describe('PaymentCard', () => {
  it('1. CHECKOUT_UNAVAILABLE never renders a clickable payment URL', () => {
    const { container } = render(<PaymentCard checkout={blocked} offer={offer} chatAction={checkoutUnavailable} />);
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.textContent).not.toMatch(/https?:|stripe\.com/i);
  });

  it('1b. even if the checkout data had a usable URL, a CHECKOUT_UNAVAILABLE action wins and no link renders', () => {
    const inconsistent = { ...blocked, usable: true, url: BLOCKED_URL, blockingIssues: [] };
    const { container } = render(<PaymentCard checkout={inconsistent} offer={offer} chatAction={checkoutUnavailable} />);
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.innerHTML).not.toContain(BLOCKED_URL);
  });

  it('2. PRICE_CONFLICT renders the blocked payment state with a disabled button and conflict details', async () => {
    render(<PaymentCard checkout={blocked} offer={offer} chatAction={checkoutUnavailable} />);
    expect(screen.getByText('Verification required')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Payment unavailable' });
    expect(button).toBeDisabled();
    expect(screen.getByText('Published program pricing and the captured checkout pricing do not currently match.')).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'View details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('$499 USD')).toBeInTheDocument();
    expect(screen.getByText(/\$179 USD/)).toHaveTextContent('$179 USD / year');
    expect(screen.getByText('Needs business confirmation')).toBeInTheDocument();
    expect(screen.getByText(/does not expose the payment link until the discrepancy is resolved/)).toBeInTheDocument();
  });

  it('blocks from the checkout data alone (no chat action yet)', () => {
    const { container } = render(<PaymentCard checkout={blocked} offer={offer} chatAction={null} />);
    expect(screen.getByRole('button', { name: 'Payment unavailable' })).toBeDisabled();
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it('renders a payment link only for a usable, unblocked checkout (domain URL, offer label)', () => {
    const usable = { ...blocked, usable: true, url: 'https://checkout.example/ok', urlWithheld: false, blockingIssues: [], verification: { ...blocked.verification, verificationStatus: 'CONFIRMED' as const } };
    render(<PaymentCard checkout={usable} offer={offer} chatAction={null} />);
    expect(screen.getByRole('link', { name: 'Enroll — $499 USD' })).toHaveAttribute('href', 'https://checkout.example/ok');
  });
});
