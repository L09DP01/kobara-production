export function isReviewAccount(merchant: { shopify_review_mode?: boolean } | null | undefined): boolean {
  return merchant?.shopify_review_mode === true;
}

export function isReviewEmail(email: string): boolean {
  return email.trim().toLowerCase() === 'test@shopify.com';
}
