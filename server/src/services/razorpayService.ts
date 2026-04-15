import Razorpay from 'razorpay';
import crypto from 'crypto';

function getRazorpay(): Razorpay {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

export async function createCustomer(
  name: string,
  email: string,
  contact?: string
): Promise<string> {
  const rzp = getRazorpay();
  const customer = await rzp.customers.create({ name, email, contact: contact ?? '' });
  return customer.id;
}

export async function createSubscription(
  customerId: string,
  planId: string,
  totalCount: number
): Promise<{ subscriptionId: string; shortUrl: string }> {
  const rzp = getRazorpay();
  const sub = await rzp.subscriptions.create({
    plan_id: planId,
    customer_notify: 1,
    quantity: 1,
    total_count: totalCount,
    customer_id: customerId,
  } as Parameters<typeof rzp.subscriptions.create>[0]);
  return {
    subscriptionId: sub.id,
    shortUrl: (sub as unknown as { short_url: string }).short_url ?? '',
  };
}

export async function cancelSubscription(
  subscriptionId: string,
  cancelAtCycleEnd: boolean
): Promise<void> {
  const rzp = getRazorpay();
  await rzp.subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
}

export async function fetchSubscription(subscriptionId: string): Promise<unknown> {
  const rzp = getRazorpay();
  return rzp.subscriptions.fetch(subscriptionId);
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
}
