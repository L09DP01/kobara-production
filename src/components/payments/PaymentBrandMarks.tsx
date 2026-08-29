import Image from 'next/image';

export type PaymentBrand = 'card' | 'paypal' | 'apple_pay' | 'google_pay';

const marks = {
  visa: { src: '/payment-brands/visa.svg', alt: 'Visa', width: 44, height: 15 },
  mastercard: { src: '/payment-brands/mastercard.svg', alt: 'Mastercard', width: 28, height: 22 },
  amex: { src: '/payment-brands/amex.svg', alt: 'American Express', width: 22, height: 22 },
  paypal: { src: '/payment-brands/paypal.svg', alt: 'PayPal', width: 22, height: 26 },
  applePay: { src: '/payment-brands/apple-pay.svg', alt: 'Apple Pay', width: 52, height: 22 },
  googlePay: { src: '/payment-brands/google-pay.svg', alt: 'Google Pay', width: 52, height: 22 },
} as const;

function Mark({ mark, className = '' }: { mark: (typeof marks)[keyof typeof marks]; className?: string }) {
  return (
    <Image
      src={mark.src}
      alt={mark.alt}
      width={mark.width}
      height={mark.height}
      className={`block h-auto max-h-6 w-auto object-contain ${className}`}
    />
  );
}

export function PaymentBrandMarks({ method }: { method: PaymentBrand }) {
  if (method === 'card') {
    return (
      <span className="flex shrink-0 items-center gap-2" aria-label="Visa, Mastercard et American Express">
        <Mark mark={marks.visa} />
        <Mark mark={marks.mastercard} />
        <Mark mark={marks.amex} />
      </span>
    );
  }

  if (method === 'paypal') {
    return (
      <span className="flex h-8 min-w-12 shrink-0 items-center justify-center rounded bg-white px-3 py-1.5">
        <Mark mark={marks.paypal} className="max-h-6" />
      </span>
    );
  }

  const walletMark = method === 'apple_pay' ? marks.applePay : marks.googlePay;
  return (
    <span className="flex h-8 min-w-16 shrink-0 items-center justify-center rounded bg-white px-2.5 py-1">
      <Mark mark={walletMark} className="max-h-5" />
    </span>
  );
}
