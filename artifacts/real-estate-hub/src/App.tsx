import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Compass,
  Copy,
  FilePenLine,
  Filter,
  Home,
  LayoutDashboard,
  Mail,
  MapPin,
  Menu,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trees,
  X,
} from 'lucide-react';
import {
  getGetListingQueryKey,
  getGetListingSummaryQueryKey,
  getListListingsQueryKey,
  useCreateListing,
  useDeleteListing,
  useGetListing,
  useGetListingSummary,
  useListListings,
  useUpdateListing,
} from '@workspace/api-client-react';
import type {
  Category,
  Listing,
  ListingInput,
  ListingType,
  ListListingsParams,
  RentalPeriod,
} from '@workspace/api-client-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

const categoryLabels: Record<Category, string> = { build: 'Villas & builds', apartment: 'Apartments', land: 'Land' };
const categoryShort: Record<Category, string> = { build: 'Build', apartment: 'Apartment', land: 'Land' };
const listingTypeLabels: Record<ListingType, string> = { sale: 'For sale', rent: 'For rent' };

function formatPrice(price: number, listingType: ListingType, rentalPeriod?: RentalPeriod | null) {
  const value = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(price);
  if (listingType === 'rent') return `${value} SAR / ${rentalPeriod === 'yearly' ? 'year' : 'month'}`;
  return `${value} SAR`;
}

function formatDate(value: string) {
  if (!value) return 'Recently added';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (error && typeof error === 'object' && 'error' in error) return String(error.error);
  return error instanceof Error ? error.message : fallback;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="grain min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-3" data-testid="link-brand">
            <span className="grid size-10 place-items-center rounded-full bg-secondary text-accent">
              <Compass size={20} strokeWidth={1.8} />
            </span>
            <span className="leading-none">
              <span className="block font-display text-[25px] tracking-tight">Mizaan</span>
              <span className="font-mono-ui text-[9px] uppercase tracking-[0.25em] text-muted-foreground">properties</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
            <Link href="/" className="text-sm font-medium text-foreground/75 transition-colors hover:text-primary" data-testid="link-browse">Browse properties</Link>
            <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-foreground/75 transition-colors hover:text-primary" data-testid="link-dashboard"><LayoutDashboard size={16} /> Operator desk</Link>
          </nav>
          <button type="button" className="rounded-lg p-2 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open navigation" data-testid="button-mobile-menu">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <nav className="border-t border-border px-5 py-4 md:hidden" aria-label="Mobile navigation">
            <Link href="/" className="block py-2 text-sm font-medium" onClick={() => setMenuOpen(false)} data-testid="link-mobile-browse">Browse properties</Link>
            <Link href="/dashboard" className="block py-2 text-sm font-medium" onClick={() => setMenuOpen(false)} data-testid="link-mobile-dashboard">Operator desk</Link>
          </nav>
        )}
      </header>
      {children}
    </div>
  );
}

function ImageFrame({ src, alt, className = '' }: { src?: string; alt: string; className?: string }) {
  return src ? (
    <img src={src} alt={alt} className={`h-full w-full object-cover ${className}`} />
  ) : (
    <div className={`flex h-full w-full items-center justify-center bg-secondary text-accent ${className}`}><Building2 size={38} strokeWidth={1.2} /></div>
  );
}

function LoadingCards() {
  return <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="overflow-hidden rounded-2xl border border-border bg-card"><div className="skeleton h-64" /><div className="space-y-3 p-5"><div className="skeleton h-3 w-1/3 rounded" /><div className="skeleton h-6 w-4/5 rounded" /><div className="skeleton h-4 w-1/2 rounded" /></div></div>)}</div>;
}

function QueryError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-14 text-center"><CircleAlert className="mb-3 text-destructive" /><h3 className="font-display text-2xl">The desk is paused</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p><button type="button" onClick={retry} className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground interactive" data-testid="button-retry">Try again</button></div>;
}

function EmptyState({ filtered = false }: { filtered?: boolean }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-20 text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-accent/25 text-secondary"><Home size={24} /></span><h3 className="mt-5 font-display text-3xl">{filtered ? 'No close matches' : 'A quiet shelf for now'}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{filtered ? 'Try clearing one of the filters or searching another neighbourhood.' : 'Newly available homes will appear here as soon as they are placed on the desk.'}</p></div>;
}

function ListingCard({ listing, compact = false }: { listing: Listing; compact?: boolean }) {
  return (
    <Link href={`/property/${listing.id}`} className={`group block overflow-hidden rounded-2xl border border-border bg-card soft-shadow interactive ${compact ? '' : 'reveal'}`} data-testid={`card-listing-${listing.id}`}>
      <div className={`relative overflow-hidden bg-secondary ${compact ? 'h-40' : 'h-64'}`}>
        <ImageFrame src={listing.images[0]} alt={listing.title} className="transition-transform duration-500 group-hover:scale-[1.04]" />
        <div className="absolute left-4 top-4 flex gap-2">
          <span className="rounded-full bg-background/90 px-3 py-1 font-mono-ui text-[10px] uppercase tracking-wider text-foreground">{listingTypeLabels[listing.listingType]}</span>
          <span className="rounded-full bg-accent px-3 py-1 font-mono-ui text-[10px] uppercase tracking-wider text-accent-foreground">{categoryShort[listing.category]}</span>
        </div>
        <span className="absolute bottom-4 right-4 rounded-full bg-secondary/90 px-3 py-1.5 font-mono-ui text-[11px] text-secondary-foreground">{formatDate(listing.createdAt)}</span>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-display text-[27px] leading-[1.02] tracking-tight">{listing.title}</h3><p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin size={13} className="text-primary" />{listing.location.district ? `${listing.location.district}, ` : ''}{listing.location.city}</p></div>
          <ArrowUpRight className="mt-1 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" size={19} />
        </div>
        <div className="mt-6 flex items-end justify-between border-t border-border pt-4">
          <div><p className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">{listingTypeLabels[listing.listingType]}</p><p className="mt-1 text-sm font-bold text-primary">{formatPrice(listing.price, listing.listingType, listing.rentalPeriod)}</p></div>
          {!compact && <span className="text-xs text-muted-foreground">{listing.owner.name}</span>}
        </div>
      </div>
    </Link>
  );
}

function PublicHome() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | undefined>();
  const [listingType, setListingType] = useState<ListingType | undefined>();
  const params = useMemo<ListListingsParams>(() => ({ search: search || undefined, category, listingType, sort: 'createdAt', order: 'desc' }), [search, category, listingType]);
  const listingsQuery = useListListings(params);
  const listings = listingsQuery.data ?? [];
  return (
    <main>
      <section className="page-grid border-b border-border">
        <div className="mx-auto grid max-w-[1440px] items-end gap-12 px-5 pb-16 pt-16 sm:px-8 lg:grid-cols-[1fr_390px] lg:px-12 lg:pb-24 lg:pt-24">
          <div className="reveal">
            <div className="mb-7 flex items-center gap-3 font-mono-ui text-[10px] uppercase tracking-[0.22em] text-primary"><span className="h-px w-8 bg-primary" />A better measure of place</div>
            <h1 className="max-w-4xl font-display text-[clamp(4rem,9vw,8.6rem)] leading-[.84] tracking-[-.045em] text-balance">Find your <em className="text-primary">next</em> address.</h1>
            <p className="mt-8 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">A considered collection of homes, land, and investment opportunities across Saudi Arabia — sorted for how you actually decide.</p>
          </div>
          <div className="reveal reveal-delay-2 relative overflow-hidden rounded-[2rem] bg-secondary p-7 text-secondary-foreground sm:p-9">
            <div className="absolute -right-10 -top-10 size-44 rounded-full border border-accent/40" /><div className="absolute -right-1 top-0 size-24 rounded-full border border-accent/30" />
            <Sparkles className="mb-12 text-accent" size={22} />
            <p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-accent">The Mizaan principle</p>
            <p className="mt-3 font-display text-3xl leading-tight">Ownership and renting are different decisions. We make the difference easy to see.</p>
            <Link href="/dashboard" className="mt-8 inline-flex items-center gap-2 text-xs font-semibold text-accent hover:underline" data-testid="link-operator-hero">Manage the collection <ArrowUpRight size={15} /></Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
        <div className="flex flex-col justify-between gap-6 border-b border-border pb-7 lg:flex-row lg:items-end">
          <div><p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-primary">Current collection</p><h2 className="mt-2 font-display text-4xl sm:text-5xl">Places with a point of view.</h2></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setListingType(undefined)} className={`rounded-full border px-4 py-2 text-xs font-semibold interactive ${!listingType ? 'border-secondary bg-secondary text-secondary-foreground' : 'border-border text-muted-foreground hover:border-secondary'}`} data-testid="button-filter-all">Everything</button>
            <button type="button" onClick={() => setListingType('sale')} className={`rounded-full border px-4 py-2 text-xs font-semibold interactive ${listingType === 'sale' ? 'border-secondary bg-secondary text-secondary-foreground' : 'border-border text-muted-foreground hover:border-secondary'}`} data-testid="button-filter-sale">For sale</button>
            <button type="button" onClick={() => setListingType('rent')} className={`rounded-full border px-4 py-2 text-xs font-semibold interactive ${listingType === 'rent' ? 'border-secondary bg-secondary text-secondary-foreground' : 'border-border text-muted-foreground hover:border-secondary'}`} data-testid="button-filter-rent">For rent</button>
          </div>
        </div>
        <div className="mt-7 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row">
          <label className="flex flex-1 items-center gap-3 rounded-xl bg-muted/70 px-4 py-3"><Search size={18} className="text-primary" /><span className="sr-only">Search properties</span><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Search by city, district, address or title" data-testid="input-search-listings" /></label>
          <div className="flex gap-2 overflow-x-auto">
            <button type="button" onClick={() => setCategory(undefined)} className={`whitespace-nowrap rounded-xl px-4 py-3 text-xs font-semibold ${!category ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`} data-testid="button-category-all">All places</button>
            {(Object.keys(categoryLabels) as Category[]).map((item) => <button type="button" key={item} onClick={() => setCategory(category === item ? undefined : item)} className={`whitespace-nowrap rounded-xl px-4 py-3 text-xs font-semibold ${category === item ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`} data-testid={`button-category-${item}`}>{categoryLabels[item]}</button>)}
          </div>
        </div>
        <div className="mt-9">{listingsQuery.isLoading ? <LoadingCards /> : listingsQuery.isError ? <QueryError message={getErrorMessage(listingsQuery.error, 'We could not load the property collection.')} retry={() => listingsQuery.refetch()} /> : listings.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div> : <EmptyState filtered={Boolean(search || category || listingType)} />}</div>
      </section>
      <section className="border-t border-border bg-secondary text-secondary-foreground">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1fr_auto] md:items-end lg:px-12 lg:py-20">
          <div><p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-accent">A clear starting point</p><h2 className="mt-3 max-w-2xl font-display text-5xl leading-[.95] sm:text-6xl">The right property starts with the right question.</h2></div>
          <div className="max-w-xs border-l border-accent/40 pl-5 text-sm leading-6 text-secondary-foreground/75">Looking to own? Start with land and builds. Need flexibility? Browse apartments and rental terms side by side.</div>
        </div>
      </section>
    </main>
  );
}

function PropertyDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const query = useGetListing(id, { query: { enabled: Boolean(id), queryKey: getGetListingQueryKey(id) } });
  const listing = query.data;
  const [activeImage, setActiveImage] = useState(0);
  const [copied, setCopied] = useState(false);
  if (query.isLoading) return <main className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12"><div className="skeleton h-[520px] rounded-[2rem]" /></main>;
  if (query.isError || !listing) return <main className="mx-auto max-w-2xl px-5 py-24 sm:px-8"><QueryError message={getErrorMessage(query.error, 'This property may have moved off the desk.')} retry={() => query.refetch()} /></main>;
  const images = listing.images.length ? listing.images : [''];
  const copyPhone = async () => { await navigator.clipboard?.writeText(listing.owner.phone); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  return (
    <main className="mx-auto max-w-[1440px] px-5 pb-16 pt-8 sm:px-8 lg:px-12 lg:pb-24">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary" data-testid="link-back-listings"><ArrowLeft size={15} /> Back to collection</Link>
      <div className="grid gap-8 lg:grid-cols-[1.16fr_.84fr] lg:gap-12">
        <section className="reveal">
          <div className="relative h-[420px] overflow-hidden rounded-[2rem] bg-secondary sm:h-[570px]">
            <ImageFrame src={images[activeImage]} alt={listing.title} />
            {images.length > 1 && <><button type="button" onClick={() => setActiveImage((activeImage - 1 + images.length) % images.length)} className="absolute left-5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-foreground" aria-label="Previous image" data-testid="button-previous-image"><ChevronLeft size={18} /></button><button type="button" onClick={() => setActiveImage((activeImage + 1) % images.length)} className="absolute right-5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-foreground" aria-label="Next image" data-testid="button-next-image"><ChevronRight size={18} /></button></>}
            <div className="absolute left-5 top-5 flex gap-2"><span className="rounded-full bg-background/90 px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-wider">{listingTypeLabels[listing.listingType]}</span><span className="rounded-full bg-accent px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-wider">{categoryShort[listing.category]}</span></div>
          </div>
          {images.length > 1 && <div className="mt-3 grid grid-cols-5 gap-2">{images.slice(0, 5).map((image, index) => <button type="button" key={`${image}-${index}`} onClick={() => setActiveImage(index)} className={`h-16 overflow-hidden rounded-lg border-2 ${activeImage === index ? 'border-primary' : 'border-transparent opacity-60'}`} data-testid={`button-thumbnail-${index}`}><ImageFrame src={image} alt={`${listing.title} view ${index + 1}`} /></button>)}</div>}
        </section>
        <section className="reveal reveal-delay-1 flex flex-col lg:pt-8">
          <p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-primary">{listingTypeLabels[listing.listingType]} · {categoryShort[listing.category]}</p>
          <h1 className="mt-4 font-display text-5xl leading-[.9] tracking-tight sm:text-7xl">{listing.title}</h1>
          <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><MapPin size={16} className="text-primary" />{listing.location.address ? `${listing.location.address}, ` : ''}{listing.location.district ? `${listing.location.district}, ` : ''}{listing.location.city}</p>
          <div className="mt-10 border-y border-border py-6"><p className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">Asking {listing.listingType === 'rent' ? 'rate' : 'price'}</p><p className="mt-2 font-display text-4xl text-primary sm:text-5xl">{formatPrice(listing.price, listing.listingType, listing.rentalPeriod)}</p></div>
          <p className="mt-8 whitespace-pre-line text-[15px] leading-7 text-foreground/75">{listing.description}</p>
          <div className="mt-auto pt-10"><div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">Owner contact</p><p className="mt-2 font-display text-2xl">{listing.owner.name}</p></div><span className="grid size-11 place-items-center rounded-full bg-accent/30 text-secondary"><ShieldCheck size={20} /></span></div><div className="mt-5 grid gap-2 sm:grid-cols-2"><a href={`tel:${listing.owner.phone}`} className="flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground interactive" data-testid="link-call-owner"><Phone size={16} /> Call owner</a><button type="button" onClick={copyPhone} className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold interactive" data-testid="button-copy-phone">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy phone'}</button></div>{listing.owner.email && <a href={`mailto:${listing.owner.email}`} className="mt-3 flex items-center gap-2 text-xs text-muted-foreground hover:text-primary" data-testid="link-email-owner"><Mail size={14} />{listing.owner.email}</a>}{listing.owner.additionalContact && <p className="mt-2 text-xs text-muted-foreground">{listing.owner.additionalContact}</p>}</div></div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <div className={`rounded-2xl border p-5 ${accent ? 'border-secondary bg-secondary text-secondary-foreground' : 'border-border bg-card'}`}><p className={`font-mono-ui text-[10px] uppercase tracking-[0.18em] ${accent ? 'text-accent' : 'text-muted-foreground'}`}>{label}</p><p className="mt-4 font-display text-5xl leading-none">{value}</p></div>;
}

function Dashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | undefined>();
  const [listingType, setListingType] = useState<ListingType | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const params = useMemo<ListListingsParams>(() => ({ search: search || undefined, category, listingType, sort: 'createdAt', order: 'desc' }), [search, category, listingType]);
  const summaryQuery = useGetListingSummary();
  const listingsQuery = useListListings(params);
  const deleteListing = useDeleteListing();
  const summary = summaryQuery.data;
  const listings = listingsQuery.data ?? [];
  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteListing.mutate({ id: deleteTarget.id }, { onSuccess: () => { setDeleteTarget(null); queryClient.invalidateQueries({ queryKey: getListListingsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetListingSummaryQueryKey() }); } });
  };
  return (
    <main className="mx-auto max-w-[1440px] px-5 pb-16 pt-10 sm:px-8 lg:px-12 lg:pb-24">
      <div className="flex flex-col justify-between gap-5 border-b border-border pb-8 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[0.2em] text-primary"><LayoutDashboard size={14} /> Inventory desk</div><h1 className="mt-3 font-display text-5xl sm:text-6xl">Good morning, operator.</h1><p className="mt-3 text-sm text-muted-foreground">Keep the collection accurate, clear and ready for its next enquiry.</p></div><Link href="/dashboard/new" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground interactive" data-testid="link-add-listing"><Plus size={17} /> Add listing</Link></div>
      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{summaryQuery.isLoading ? [1,2,3,4,5,6].map((item) => <div key={item} className="skeleton h-32 rounded-2xl" />) : summaryQuery.isError ? <div className="col-span-full"><QueryError message={getErrorMessage(summaryQuery.error)} retry={() => summaryQuery.refetch()} /></div> : summary && <><StatCard label="Total listings" value={summary.total} accent /><StatCard label="Builds" value={summary.builds} /><StatCard label="Apartments" value={summary.apartments} /><StatCard label="Land" value={summary.lands} /><StatCard label="For sale" value={summary.sale} /><StatCard label="For rent" value={summary.rent} /></>}</section>
      <section className="mt-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-primary">Inventory</p><h2 className="mt-2 font-display text-4xl">All listings</h2></div><div className="flex flex-col gap-2 sm:flex-row"><label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 sm:min-w-64"><Search size={16} className="text-primary" /><span className="sr-only">Search inventory</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search inventory" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" data-testid="input-dashboard-search" /></label><select value={category ?? ''} onChange={(event) => setCategory((event.target.value || undefined) as Category | undefined)} className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none" data-testid="select-dashboard-category"><option value="">All categories</option><option value="build">Builds</option><option value="apartment">Apartments</option><option value="land">Land</option></select><select value={listingType ?? ''} onChange={(event) => setListingType((event.target.value || undefined) as ListingType | undefined)} className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none" data-testid="select-dashboard-type"><option value="">Sale & rent</option><option value="sale">Sale</option><option value="rent">Rent</option></select></div></div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">{listingsQuery.isLoading ? <div className="space-y-3 p-6">{[1,2,3,4].map((item) => <div key={item} className="skeleton h-16 rounded-xl" />)}</div> : listingsQuery.isError ? <div className="p-5"><QueryError message={getErrorMessage(listingsQuery.error)} retry={() => listingsQuery.refetch()} /></div> : listings.length === 0 ? <div className="p-5"><EmptyState filtered={Boolean(search || category || listingType)} /></div> : <><div className="hidden overflow-x-auto md:block"><table className="w-full text-left"><thead className="border-b border-border bg-muted/50"><tr className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground"><th className="px-5 py-4 font-normal">Property</th><th className="px-5 py-4 font-normal">Type</th><th className="px-5 py-4 font-normal">Location</th><th className="px-5 py-4 font-normal">Price</th><th className="px-5 py-4 font-normal">Updated</th><th className="px-5 py-4 text-right font-normal">Actions</th></tr></thead><tbody>{listings.map((listing) => <tr key={listing.id} className="border-b border-border/70 last:border-0 hover:bg-muted/30" data-testid={`row-listing-${listing.id}`}><td className="max-w-[280px] px-5 py-4"><div className="flex items-center gap-3"><div className="size-12 shrink-0 overflow-hidden rounded-lg bg-secondary"><ImageFrame src={listing.images[0]} alt="" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold">{listing.title}</p><p className="mt-1 font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">{categoryShort[listing.category]}</p></div></div></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 font-mono-ui text-[10px] uppercase ${listing.listingType === 'sale' ? 'bg-accent/35 text-accent-foreground' : 'bg-secondary text-secondary-foreground'}`}>{listingTypeLabels[listing.listingType]}</span></td><td className="px-5 py-4 text-sm text-muted-foreground">{listing.location.district ? `${listing.location.district}, ` : ''}{listing.location.city}</td><td className="px-5 py-4 text-sm font-semibold text-primary">{formatPrice(listing.price, listing.listingType, listing.rentalPeriod)}</td><td className="px-5 py-4 text-xs text-muted-foreground">{formatDate(listing.updatedAt)}</td><td className="px-5 py-4"><div className="flex justify-end gap-1"><Link href={`/dashboard/edit/${listing.id}`} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary" aria-label={`Edit ${listing.title}`} data-testid={`link-edit-listing-${listing.id}`}><FilePenLine size={16} /></Link><button type="button" onClick={() => setDeleteTarget(listing)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${listing.title}`} data-testid={`button-delete-listing-${listing.id}`}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div><div className="divide-y divide-border md:hidden">{listings.map((listing) => <div key={listing.id} className="p-4" data-testid={`mobile-listing-${listing.id}`}><div className="flex gap-3"><div className="size-20 shrink-0 overflow-hidden rounded-xl bg-secondary"><ImageFrame src={listing.images[0]} alt="" /></div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{listing.title}</p><p className="mt-1 text-xs text-muted-foreground">{listing.location.city}</p><p className="mt-2 text-sm font-bold text-primary">{formatPrice(listing.price, listing.listingType, listing.rentalPeriod)}</p></div></div><div className="mt-4 flex justify-end gap-2"><Link href={`/property/${listing.id}`} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold" data-testid={`link-view-mobile-${listing.id}`}>View</Link><Link href={`/dashboard/edit/${listing.id}`} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold" data-testid={`link-edit-mobile-${listing.id}`}>Edit</Link><button type="button" onClick={() => setDeleteTarget(listing)} className="rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive" data-testid={`button-delete-mobile-${listing.id}`}>Delete</button></div></div>)}</div></>}</div>
      </section>
      {deleteTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-5" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 soft-shadow"><div className="flex items-start justify-between"><div><span className="grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive"><Trash2 size={18} /></span><h2 className="mt-5 font-display text-3xl">Remove this listing?</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">“{deleteTarget.title}” will leave the collection permanently.</p></div><button type="button" onClick={() => setDeleteTarget(null)} aria-label="Close confirmation" data-testid="button-close-delete"><X size={19} /></button></div><div className="mt-7 flex gap-2"><button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold" data-testid="button-cancel-delete">Keep listing</button><button type="button" onClick={confirmDelete} disabled={deleteListing.isPending} className="flex-1 rounded-xl bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground disabled:opacity-60" data-testid="button-confirm-delete">{deleteListing.isPending ? 'Removing…' : 'Remove listing'}</button></div></div></div>}
    </main>
  );
}

type FormState = {
  title: string; category: Category; listingType: ListingType; description: string; price: string; rentalPeriod: RentalPeriod;
  ownerName: string; ownerPhone: string; ownerEmail: string; ownerAdditional: string;
  address: string; city: string; district: string; images: string[];
};

const emptyForm: FormState = { title: '', category: 'apartment', listingType: 'rent', description: '', price: '', rentalPeriod: 'monthly', ownerName: '', ownerPhone: '', ownerEmail: '', ownerAdditional: '', address: '', city: '', district: '', images: [''] };

function ListingForm({ editId }: { editId?: string }) {
  const isEdit = Boolean(editId);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [location, setLocation] = useLocation();
  const listingQuery = useGetListing(editId ?? '', { query: { enabled: isEdit, queryKey: getGetListingQueryKey(editId ?? '') } });
  const createListing = useCreateListing();
  const updateListing = useUpdateListing();
  const saving = createListing.isPending || updateListing.isPending;
  useEffect(() => {
    const listing = listingQuery.data;
    if (!listing) return;
    setForm({ title: listing.title, category: listing.category, listingType: listing.listingType, description: listing.description, price: String(listing.price), rentalPeriod: listing.rentalPeriod ?? 'monthly', ownerName: listing.owner.name, ownerPhone: listing.owner.phone, ownerEmail: listing.owner.email ?? '', ownerAdditional: listing.owner.additionalContact ?? '', address: listing.location.address ?? '', city: listing.location.city, district: listing.location.district ?? '', images: listing.images.length ? listing.images : [''] });
  }, [listingQuery.data]);
  const setField = (key: keyof FormState, value: string) => {
    setForm((current) => {
      if (key === 'category' && value === 'land') return { ...current, category: 'land', listingType: 'sale', rentalPeriod: 'monthly' };
      if (key === 'category') return { ...current, category: value as Category };
      if (key === 'listingType') return { ...current, listingType: value as ListingType };
      return { ...current, [key]: value };
    });
    setErrors((current) => ({ ...current, [key]: '' }));
  };
  const validate = () => {
    const next: Record<string, string> = {};
    if (form.title.trim().length < 2) next.title = 'Use at least 2 characters.';
    if (form.description.trim().length < 10) next.description = 'Add at least 10 characters.';
    if (!form.price || Number(form.price) < 0) next.price = 'Enter a valid price.';
    if (!form.ownerName.trim()) next.ownerName = 'Owner name is required.';
    if (!form.ownerPhone.trim()) next.ownerPhone = 'Phone is required.';
    if (!form.city.trim()) next.city = 'City is required.';
    if (form.images.filter(Boolean).length < 1) next.images = 'Add at least one image URL.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setServerError('');
    if (!validate()) return;
    const payload: ListingInput = { title: form.title.trim(), category: form.category, listingType: form.category === 'land' ? 'sale' : form.listingType, description: form.description.trim(), price: Number(form.price), rentalPeriod: form.category === 'land' || form.listingType === 'sale' ? null : form.rentalPeriod, owner: { name: form.ownerName.trim(), phone: form.ownerPhone.trim(), email: form.ownerEmail.trim() || null, additionalContact: form.ownerAdditional.trim() || null }, location: { address: form.address.trim() || null, city: form.city.trim(), district: form.district.trim() || null }, images: form.images.map((image) => image.trim()).filter(Boolean) };
    const options = { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListListingsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetListingSummaryQueryKey() }); setLocation('/dashboard'); }, onError: (error: unknown) => setServerError(getErrorMessage(error, 'The listing could not be saved.')) };
    if (isEdit && editId) updateListing.mutate({ id: editId, data: payload }, options); else createListing.mutate({ data: payload }, options);
  };
  if (isEdit && listingQuery.isLoading) return <main className="mx-auto max-w-[1120px] px-5 py-12 sm:px-8 lg:px-12"><div className="skeleton h-[700px] rounded-2xl" /></main>;
  if (isEdit && listingQuery.isError) return <main className="mx-auto max-w-2xl px-5 py-20"><QueryError message={getErrorMessage(listingQuery.error)} retry={() => listingQuery.refetch()} /></main>;
  const inputClass = (key: string) => `mt-2 w-full rounded-xl border bg-card px-3.5 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 ${errors[key] ? 'border-destructive' : 'border-border'}`;
  return (
    <main className="mx-auto max-w-[1120px] px-5 pb-16 pt-10 sm:px-8 lg:px-12 lg:pb-24">
      <Link href="/dashboard" className="mb-8 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary" data-testid="link-back-dashboard"><ArrowLeft size={15} /> Back to operator desk</Link>
      <div className="mb-9 border-b border-border pb-8"><p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-primary">{isEdit ? 'Refine listing' : 'New listing'}</p><h1 className="mt-3 font-display text-5xl sm:text-6xl">{isEdit ? 'Edit the details.' : 'Place something good.'}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">The more precise the details, the easier it is for someone to recognise the right place.</p></div>
      {serverError && <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><CircleAlert size={17} />{serverError}</div>}
      <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_330px]">
        <div className="space-y-7">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-7"><div className="mb-6 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-accent text-sm font-bold">01</span><h2 className="font-display text-3xl">The property</h2></div><div className="grid gap-5"><label className="text-sm font-semibold">Title<input value={form.title} onChange={(event) => setField('title', event.target.value)} className={inputClass('title')} placeholder="e.g. A courtyard home in Al Malqa" data-testid="input-title" />{errors.title && <ErrorText text={errors.title} />}</label><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Category<select value={form.category} onChange={(event) => setField('category', event.target.value)} className={inputClass('category')} data-testid="select-category"><option value="apartment">Apartment</option><option value="build">Villa / build</option><option value="land">Land</option></select></label><label className="text-sm font-semibold">Listing type<select value={form.category === 'land' ? 'sale' : form.listingType} disabled={form.category === 'land'} onChange={(event) => setField('listingType', event.target.value)} className={`${inputClass('listingType')} disabled:cursor-not-allowed disabled:opacity-55`} data-testid="select-listing-type"><option value="sale">For sale</option><option value="rent">For rent</option></select>{form.category === 'land' && <span className="mt-1 block text-[11px] text-muted-foreground">Land is always marked for sale.</span>}</label></div><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Price (SAR)<input type="number" min="0" value={form.price} onChange={(event) => setField('price', event.target.value)} className={inputClass('price')} placeholder="0" data-testid="input-price" />{errors.price && <ErrorText text={errors.price} />}</label>{form.category !== 'land' && form.listingType === 'rent' && <label className="text-sm font-semibold">Rental period<select value={form.rentalPeriod} onChange={(event) => setField('rentalPeriod', event.target.value)} className={inputClass('rentalPeriod')} data-testid="select-rental-period"><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>}</div><label className="text-sm font-semibold">Description<textarea value={form.description} onChange={(event) => setField('description', event.target.value)} className={`${inputClass('description')} min-h-32 resize-y`} placeholder="Describe what makes this place worth a closer look." data-testid="textarea-description" />{errors.description && <ErrorText text={errors.description} />}</label></div></section>
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-7"><div className="mb-6 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-accent text-sm font-bold">02</span><h2 className="font-display text-3xl">Where it is</h2></div><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold sm:col-span-2">Address <span className="font-normal text-muted-foreground">(optional)</span><input value={form.address} onChange={(event) => setField('address', event.target.value)} className={inputClass('address')} placeholder="Street, building or plot reference" data-testid="input-address" /></label><label className="text-sm font-semibold">City<input value={form.city} onChange={(event) => setField('city', event.target.value)} className={inputClass('city')} placeholder="Riyadh" data-testid="input-city" />{errors.city && <ErrorText text={errors.city} />}</label><label className="text-sm font-semibold">District <span className="font-normal text-muted-foreground">(optional)</span><input value={form.district} onChange={(event) => setField('district', event.target.value)} className={inputClass('district')} placeholder="Al Nakheel" data-testid="input-district" /></label></div></section>
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-7"><div className="mb-6 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-accent text-sm font-bold">03</span><h2 className="font-display text-3xl">Images</h2></div><p className="mb-4 text-sm leading-6 text-muted-foreground">Paste direct image URLs. The first image becomes the cover.</p><div className="space-y-3">{form.images.map((image, index) => <div key={index} className="flex gap-2"><input value={image} onChange={(event) => { const images = [...form.images]; images[index] = event.target.value; setForm({ ...form, images }); }} className={inputClass('images')} placeholder="https://..." data-testid={`input-image-${index}`} />{form.images.length > 1 && <button type="button" onClick={() => setForm({ ...form, images: form.images.filter((_, imageIndex) => imageIndex !== index) })} className="mt-2 rounded-xl border border-border px-3 text-muted-foreground hover:text-destructive" aria-label="Remove image URL" data-testid={`button-remove-image-${index}`}><X size={16} /></button>}</div>)}{errors.images && <ErrorText text={errors.images} />}<button type="button" onClick={() => setForm({ ...form, images: [...form.images, ''] })} className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline" data-testid="button-add-image"><Plus size={14} /> Add another image</button></div></section>
        </div>
        <aside className="h-fit space-y-7 lg:sticky lg:top-28">
          <section className="rounded-2xl border border-border bg-secondary p-6 text-secondary-foreground"><div className="mb-6 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">04</span><h2 className="font-display text-3xl">Owner</h2></div><div className="space-y-4"><label className="block text-sm font-semibold">Name<input value={form.ownerName} onChange={(event) => setField('ownerName', event.target.value)} className={`${inputClass('ownerName')} border-sidebar-border bg-sidebar-accent`} placeholder="Full name" data-testid="input-owner-name" />{errors.ownerName && <ErrorText text={errors.ownerName} />}</label><label className="block text-sm font-semibold">Phone<input value={form.ownerPhone} onChange={(event) => setField('ownerPhone', event.target.value)} className={`${inputClass('ownerPhone')} border-sidebar-border bg-sidebar-accent`} placeholder="+966 ..." data-testid="input-owner-phone" />{errors.ownerPhone && <ErrorText text={errors.ownerPhone} />}</label><label className="block text-sm font-semibold">Email <span className="font-normal opacity-60">(optional)</span><input type="email" value={form.ownerEmail} onChange={(event) => setField('ownerEmail', event.target.value)} className={`${inputClass('ownerEmail')} border-sidebar-border bg-sidebar-accent`} placeholder="name@example.com" data-testid="input-owner-email" /></label><label className="block text-sm font-semibold">Additional contact <span className="font-normal opacity-60">(optional)</span><input value={form.ownerAdditional} onChange={(event) => setField('ownerAdditional', event.target.value)} className={`${inputClass('ownerAdditional')} border-sidebar-border bg-sidebar-accent`} placeholder="WhatsApp, office hours..." data-testid="input-owner-additional" /></label></div></section>
          <div className="rounded-2xl border border-border bg-card p-5"><div className="flex gap-3 text-sm"><ShieldCheck className="shrink-0 text-primary" size={19} /><p className="leading-6 text-muted-foreground">Review every field before publishing. A clean listing earns a quicker first conversation.</p></div><button type="submit" disabled={saving} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-60" data-testid="button-save-listing">{saving ? 'Saving listing…' : isEdit ? 'Save changes' : 'Publish listing'}<ArrowUpRight size={16} /></button><button type="button" onClick={() => setLocation('/dashboard')} className="mt-3 w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold" data-testid="button-cancel-form">Cancel</button></div>
        </aside>
      </form>
    </main>
  );
}

function ErrorText({ text }: { text: string }) { return <span className="mt-1 block text-xs font-normal text-destructive">{text}</span>; }

function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return <RoutedErrorBoundary><Shell><Switch><Route path="/" component={PublicHome} /><Route path="/property/:id" component={PropertyDetail} /><Route path="/dashboard" component={Dashboard} /><Route path="/dashboard/new" component={() => <ListingForm />} /><Route path="/dashboard/edit/:id" component={() => { const { id } = useParams<{ id: string }>(); return <ListingForm editId={id} />; }} /><Route component={NotFound} /></Switch></Shell></RoutedErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;