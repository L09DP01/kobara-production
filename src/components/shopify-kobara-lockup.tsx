import Image from 'next/image';
import Link from 'next/link';

export function ShopifyKobaraLockup({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2" aria-label="Shopify avec Kobara">
        <a href="https://www.shopify.com" target="_blank" rel="noreferrer" title="Shopify" className="inline-flex">
          <Image src="/shopify-bag.svg" alt="Shopify" width={22} height={25} className="h-6 w-auto" />
        </a>
        <span className="text-xs font-bold text-slate-500" aria-hidden="true">×</span>
        <Link href="/" title="Kobara" className="inline-flex">
          <Image src="/Icone.png" alt="Kobara" width={24} height={24} className="h-6 w-6 rounded-md object-contain" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3" aria-label="Shopify avec Kobara">
      <a href="https://www.shopify.com" target="_blank" rel="noreferrer" aria-label="Visiter Shopify" className="inline-flex items-center">
        <Image src="/shopify-logo-inverted.svg" alt="Shopify" width={88} height={25} className="h-auto w-[88px]" />
      </a>
      <span className="text-sm font-bold text-slate-500" aria-hidden="true">×</span>
      <Link href="/" aria-label="Accueil Kobara" className="inline-flex items-center gap-2">
        <Image src="/Icone.png" alt="" width={26} height={26} className="h-[26px] w-[26px] rounded-md object-contain" />
        <span className="text-sm font-extrabold text-white">Kobara</span>
      </Link>
    </div>
  );
}
