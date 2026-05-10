const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('#navLinks');
const contactForm = document.querySelector('#contactForm');
const quickSearch = document.querySelector('#quickSearch');
const toast = document.querySelector('#toast');
const cookieBanner = document.querySelector('#cookieBanner');
const acceptCookies = document.querySelector('#acceptCookies');
const dismissCookies = document.querySelector('#dismissCookies');
const navAnchors = [...document.querySelectorAll('.nav-links a[href^="#"]')];

const supabaseConfig = {
  url: window.NIMBUS_SUPABASE_URL || document.querySelector('meta[name="supabase-url"]')?.content || '',
  anonKey: window.NIMBUS_SUPABASE_ANON_KEY || document.querySelector('meta[name="supabase-anon-key"]')?.content || ''
};

const storage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage can be disabled in private browsing; the UI should still work.
    }
  }
};

let latestSearch = {};

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 4200);
}

function closeMenu() {
  navLinks?.classList.remove('is-open');
  menuToggle?.setAttribute('aria-expanded', 'false');
}

async function saveWaitlistLead(payload) {
  const normalizedPayload = {
    ...payload,
    created_at: new Date().toISOString()
  };

  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    storage.set('nimbusWaitlistLead', JSON.stringify(normalizedPayload));
    return { mode: 'local' };
  }

  const response = await fetch(`${supabaseConfig.url.replace(/\/$/, '')}/rest/v1/waitlist_leads`, {
    method: 'POST',
    headers: {
      apikey: supabaseConfig.anonKey,
      Authorization: `Bearer ${supabaseConfig.anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(normalizedPayload)
  });

  if (!response.ok) throw new Error('Supabase waitlist save failed');
  return { mode: 'supabase' };
}

menuToggle?.addEventListener('click', () => {
  if (!navLinks) return;
  const isOpen = navLinks.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

navLinks?.addEventListener('click', (event) => {
  if (event.target.matches('a')) closeMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

quickSearch?.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(quickSearch);
  latestSearch = {
    campus_preference: formData.get('campus'),
    budget_preference: formData.get('budget'),
    move_in_preference: formData.get('moveIn')
  };
  storage.set('nimbusLatestSearch', JSON.stringify(latestSearch));
  showToast(`Early AI match saved: ${latestSearch.campus_preference}, ${latestSearch.budget_preference} budget preference, ${latestSearch.move_in_preference}. Join the waitlist for launch access.`);
  document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => contactForm?.querySelector('input[name="name"]')?.focus(), 650);
});

contactForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(contactForm);
  const name = formData.get('name') || 'there';
  const role = formData.get('role') || 'supporter';
  const payload = {
    name: name.toString(),
    email: formData.get('email')?.toString() || '',
    phone: formData.get('phone')?.toString() || '',
    role: role.toString(),
    message: formData.get('message')?.toString() || '',
    ...latestSearch
  };

  try {
    const result = await saveWaitlistLead(payload);
    contactForm.reset();
    const savedWhere = result.mode === 'supabase' ? 'Supabase waitlist' : 'local preview waitlist';
    showToast(`Thanks ${name}! Your ${role.toString().toLowerCase()} interest is saved to the ${savedWhere}.`);
  } catch (error) {
    storage.set('nimbusWaitlistLead', JSON.stringify(payload));
    showToast('Supabase is not reachable right now, so your interest was saved locally for this preview.');
  }
});

if (cookieBanner && storage.get('nimbusCookieOK') !== 'true') {
  cookieBanner.hidden = false;
}

function saveCookiePreference(message) {
  storage.set('nimbusCookieOK', 'true');
  if (cookieBanner) cookieBanner.hidden = true;
  showToast(message);
}

acceptCookies?.addEventListener('click', () => {
  saveCookiePreference('Cookie preference saved.');
});

dismissCookies?.addEventListener('click', () => {
  saveCookiePreference('Essential-only cookie preference saved.');
});

if ('IntersectionObserver' in window && navAnchors.length) {
  const sections = navAnchors
    .map(anchor => document.querySelector(anchor.getAttribute('href')))
    .filter(Boolean);

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navAnchors.forEach(anchor => {
      anchor.classList.toggle('is-active', anchor.getAttribute('href') === `#${visible.target.id}`);
    });
  }, { rootMargin: '-35% 0px -55%', threshold: [0.08, 0.25, 0.5] });

  sections.forEach(section => observer.observe(section));
}
