import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api/client';
import { ApiProvider } from '@/lib/api/ApiContext';
import { BLOCKED_URL, chatResponse, checkoutUnavailable, SLUG, stubApi, viewProduct } from '@/test/fixtures';
import { DemoApp } from './DemoApp';

function renderApp(api = stubApi()) {
  render(
    <ApiProvider client={api}>
      <DemoApp timezone="Europe/London" />
    </ApiProvider>,
  );
  return api;
}

async function ask(text: string) {
  const input = screen.getByLabelText('Message');
  await userEvent.type(input, `${text}{Enter}`);
}

describe('DemoApp', () => {
  it('shows starter queries that send real messages', async () => {
    const api = renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'How do I enroll and pay?' }));
    expect(api.chat).toHaveBeenCalledWith(expect.objectContaining({ message: 'How do I enroll and pay?', timezone: 'Europe/London', history: [] }));
  });

  it('3. VIEW_PRODUCT updates the product panel from the product API', async () => {
    const api = stubApi({ chat: vi.fn().mockResolvedValue(chatResponse({ actions: [viewProduct], context: { productSlugs: [SLUG] } })) });
    renderApp(api);
    const panel = screen.getByRole('complementary', { name: 'Structured product data' });
    expect(within(panel).getByText(/structured product data will appear here/)).toBeInTheDocument();

    await ask('Tell me about the annual program');
    await waitFor(() => expect(within(panel).getByText('1-Year Online Ballet Club')).toBeInTheDocument());
    expect(api.getProduct).toHaveBeenCalledWith(SLUG);
    expect(api.getCheckout).toHaveBeenCalledWith(SLUG);
    expect(within(panel).getByText('48 included')).toBeInTheDocument();
  });

  it('4. passes conversation history (with product context) to subsequent chat requests', async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce(chatResponse({ message: 'Found the program.', actions: [viewProduct], context: { productSlugs: [SLUG] } }))
      .mockResolvedValueOnce(chatResponse({ message: 'It is priced as shown.', context: { productSlugs: [SLUG] } }));
    renderApp(stubApi({ chat }));

    await ask("I'm interested in the VSA 1-Year Online Ballet Club.");
    await screen.findByText('Found the program.');
    await ask('How much is it?');
    await screen.findByText('It is priced as shown.');

    expect(chat).toHaveBeenNthCalledWith(2, {
      message: 'How much is it?',
      timezone: 'Europe/London',
      history: [
        { role: 'user', content: "I'm interested in the VSA 1-Year Online Ballet Club." },
        { role: 'assistant', content: 'Found the program.', productSlugs: [SLUG] },
      ],
    });
  });

  it('6. shows an understandable error when the AI is unavailable, and keeps the failed turn out of history', async () => {
    const chat = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('AI_UNAVAILABLE', 'The AI assistant is currently unavailable on the server (it may not be configured).', 503))
      .mockResolvedValueOnce(chatResponse({ message: 'Back online.' }));
    renderApp(stubApi({ chat }));

    await ask('Hello?');
    expect(await screen.findByRole('alert')).toHaveTextContent(/AI assistant is currently unavailable/);
    await ask('Hello again');
    await screen.findByText('Back online.');
    expect(chat).toHaveBeenNthCalledWith(2, expect.objectContaining({ history: [] }));
  });

  it('renders the blocked payment state and trace for a "How do I enroll and pay?" answer, with no URL anywhere', async () => {
    const api = stubApi({
      chat: vi.fn().mockResolvedValue(
        chatResponse({
          message: 'Payment is withheld until the conflict is resolved.',
          actions: [viewProduct, checkoutUnavailable],
          context: { productSlugs: [SLUG] },
          toolTrace: [
            { tool: 'search_products', success: true, durationMs: 12, arguments: { business: 'VSA' }, errorCode: null },
            { tool: 'get_checkout', success: true, durationMs: 4, arguments: { productSlug: SLUG }, errorCode: null },
          ],
        }),
      ),
    });
    renderApp(api);
    await ask('How do I enroll and pay?');
    await screen.findByText('Payment is withheld until the conflict is resolved.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Payment unavailable' })).toBeDisabled());
    expect(screen.getByText(/Online payment is unavailable for this product/)).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getAllByText('get_checkout').length).toBeGreaterThan(0);
    const trace = screen.getByText('Technical details').closest('details')!;
    expect(trace.open).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Show trace' }));
    expect(trace.open).toBe(true);
    expect(document.body.innerHTML).not.toContain(BLOCKED_URL);
    expect(document.querySelectorAll('a')).toHaveLength(0);
  });

  it('renders a structured date card from a check_date tool call', async () => {
    const api = stubApi({
      chat: vi.fn().mockResolvedValue(
        chatResponse({
          message: 'Nov 6 is not a class day.',
          toolTrace: [{ tool: 'check_date', success: true, durationMs: 9, arguments: { productSlug: SLUG, date: '2026-11-06', timezone: 'Europe/London' }, errorCode: null }],
        }),
      ),
    });
    renderApp(api);
    await ask('Can I join around November 6, 2026?');
    // The loading frame is replaced once data arrives, so re-query after it loads.
    await waitFor(() => expect(screen.getByRole('group', { name: 'Date check' })).toHaveTextContent(/Friday, November 6, 2026/));
    const card = screen.getByRole('group', { name: 'Date check' });
    expect(api.dateCheck).toHaveBeenCalledWith(SLUG, '2026-11-06', 'Europe/London');
    expect(within(card).getByText('Not a regular class day')).toBeInTheDocument();
    expect(within(card).getByText('Saturdays')).toBeInTheDocument();
    expect(within(card).getByText(/Saturday, November 7, 2026/)).toBeInTheDocument();
    expect(within(card).getByText('Exception/cancellation information has not been confirmed for this date.')).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/CANDIDATE_UNCONFIRMED/);
  });
});
