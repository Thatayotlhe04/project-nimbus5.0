// Static adapter for GitHub Pages. The Express app still owns real API behavior.
(function () {
  const isPages = location.hostname.endsWith('github.io');
  const repoBase = (() => {
    const parts = location.pathname.split('/').filter(Boolean);
    return isPages && parts[0] ? `/${parts[0]}/` : './';
  })();
  const samePage = (file, search = '') => `${repoBase}${file}${search}`;
  const pageFor = (path, search = '') => {
    if (path === '/' || path === '') return `${repoBase}${search}`;
    if (path === '/browse') return samePage('browse.html', search);
    if (path === '/pricing') return samePage('pricing.html', search);
    if (path === '/landlord') return samePage('landlord.html', search);
    if (path === '/about') return samePage('about.html', search);
    if (path === '/legal/privacy') return samePage('legal-privacy.html', search);
    if (path === '/legal/terms') return samePage('legal-terms.html', search);
    if (path === '/legal/cookies') return samePage('legal-cookies.html', search);
    const listing = path.match(/^\/listing\/([^/]+)$/);
    if (listing) return samePage('listing.html', `?id=${encodeURIComponent(listing[1])}${search ? '&' + search.slice(1) : ''}`);
    const book = path.match(/^\/book\/([^/]+)$/);
    if (book) return samePage('book.html', `?id=${encodeURIComponent(book[1])}${search ? '&' + search.slice(1) : ''}`);
    const booking = path.match(/^\/booking\/([^/]+)$/);
    if (booking) return samePage('confirmation.html', `?ref=${encodeURIComponent(booking[1])}`);
    return null;
  };

  window.NIMBUS_PAGE = {
    routeId() {
      const q = new URLSearchParams(location.search);
      return q.get('id') || location.pathname.split('/').pop();
    },
    routeRef() {
      const q = new URLSearchParams(location.search);
      return q.get('ref') || location.pathname.split('/').pop();
    },
    href(path, search = '') {
      return pageFor(path, search) || path + search;
    },
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest && event.target.closest('a[href^="/"]');
    if (!link || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.getAttribute('href'), location.origin);
    const next = pageFor(url.pathname, url.search);
    if (!next) return;
    event.preventDefault();
    location.href = next + url.hash;
  }, true);

  if (!isPages) return;

  const originalFetch = window.fetch.bind(window);
  let dataPromise = null;
  const loadData = () => {
    dataPromise ||= originalFetch(new URL('./demo-data.json', document.currentScript?.src || location.href))
      .then((res) => res.json());
    return dataPromise;
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const roomScore = (listing, campusId) => campusId && listing.verified ? 80 : 60;
  const decorate = (listing, campusId) => campusId ? {
    ...listing,
    commute: { km: 4.2, walkMin: 24, combiMin: listing.neighbourhood === 'Phakalane' ? null : 18 },
    combi: listing.neighbourhood === 'Phakalane' ? null : { label: 'Good', score: roomScore(listing, campusId), routes: [] },
  } : listing;

  window.fetch = async (input, init) => {
    const raw = typeof input === 'string' ? input : input.url;
    const url = new URL(raw, location.origin);
    if (!url.pathname.startsWith('/api/')) return originalFetch(input, init);

    const data = await loadData();
    if (url.pathname === '/api/campuses') return json({ campuses: data.campuses });
    if (url.pathname === '/api/listings') {
      const campus = url.searchParams.get('campus') || '';
      let listings = data.listings.map((l) => decorate(l, campus));
      const roomType = url.searchParams.get('roomType');
      const maxRent = Number(url.searchParams.get('maxRent') || 0);
      if (roomType) listings = listings.filter((l) => l.roomType === roomType);
      if (maxRent) listings = listings.filter((l) => l.rent <= maxRent);
      if (url.searchParams.get('verifiedOnly') === 'true') listings = listings.filter((l) => l.verified);
      if (url.searchParams.get('combiOnly') === 'true') listings = listings.filter((l) => l.combi);
      return json({ count: listings.length, listings });
    }
    const listing = url.pathname.match(/^\/api\/listings\/([^/]+)$/);
    if (listing) {
      const item = data.listings.find((l) => l.id === listing[1]);
      return item ? json({ listing: decorate(item, url.searchParams.get('campus') || ''), campuses: data.campuses }) : json({ error: 'Listing not found' }, 404);
    }
    if (url.pathname === '/api/payments/info') {
      return json({ mode: 'demo', providers: [
        { id: 'orange_money', name: 'Orange Money' },
        { id: 'smega', name: 'Smega' },
        { id: 'myzaka', name: 'MyZaka' },
      ], settlement: { bank: 'Access Bank Botswana', accountMasked: '****1234' } });
    }
    if (url.pathname === '/api/waitlist') return json({ ok: true, demo: true });
    if (url.pathname === '/api/bookings' && (init?.method || 'GET').toUpperCase() === 'POST') {
      return json({ ok: true, reference: 'DEMO-BOOKING', booking: { reference: 'DEMO-BOOKING' } }, 201);
    }
    if (url.pathname.startsWith('/api/bookings/')) {
      const first = data.listings[0];
      return json({
        booking: {
          reference: 'DEMO-BOOKING', listing_id: first.id, status: 'held_in_escrow',
          move_in_date: new Date().toISOString().slice(0, 10), rent: first.rent,
          deposit: first.deposit, service_fee: 232, escrow_held: first.rent + first.deposit,
          total_paid: first.rent + first.deposit + 232, platform_commission: 174,
          landlord_payout: first.rent + first.deposit - 174, payment_provider: 'orange_money',
        },
        listing: first,
      });
    }
    if (url.pathname === '/api/subscriptions/start') return json({ ok: true, demo: true }, 201);
    return json({ error: 'Static demo endpoint' }, 404);
  };
})();
