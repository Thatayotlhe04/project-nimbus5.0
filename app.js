const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('#navLinks');
const contactForm = document.querySelector('#contactForm');
const quickSearch = document.querySelector('#quickSearch');
const toast = document.querySelector('#toast');
const cookieBanner = document.querySelector('#cookieBanner');
const acceptCookies = document.querySelector('#acceptCookies');
const dismissCookies = document.querySelector('#dismissCookies');
const formStatus = document.querySelector('#formStatus');
const navAnchors = [...document.querySelectorAll('.nav-links a[href^="#"]')]
  .filter(anchor => document.getElementById(anchor.getAttribute('href').slice(1)));

const supabaseConfig = {
  url: window.NIMBUSHABOR_SUPABASE_URL || window.NIMBUS_SUPABASE_URL || document.querySelector('meta[name="supabase-url"]')?.content || '',
  anonKey: window.NIMBUSHABOR_SUPABASE_ANON_KEY || window.NIMBUS_SUPABASE_ANON_KEY || document.querySelector('meta[name="supabase-anon-key"]')?.content || ''
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

function readStoredSearch() {
  try {
    return JSON.parse(storage.get('nimbushaborLatestSearch') || '{}');
  } catch {
    return {};
  }
}

let latestSearch = readStoredSearch();

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 4200);
}

function setFormStatus(message, state = 'idle') {
  if (!formStatus) return;
  formStatus.textContent = message;
  formStatus.dataset.state = state;
}

function setFormBusy(isBusy) {
  const submitButton = contactForm?.querySelector('button[type="submit"]');
  if (!submitButton) return;
  submitButton.disabled = isBusy;
  submitButton.textContent = isBusy ? 'Saving...' : 'Join the waitlist';
}

function closeMenu() {
  navLinks?.classList.remove('is-open');
  menuToggle?.setAttribute('aria-expanded', 'false');
}

function normalizeLeadPayload(payload) {
  return {
    name: payload.name?.trim(),
    email: payload.email?.trim().toLowerCase(),
    phone: payload.phone?.trim() || null,
    role: payload.role,
    message: payload.message?.trim() || null,
    campus_preference: payload.campus_preference || null,
    budget_preference: payload.budget_preference || null,
    move_in_preference: payload.move_in_preference || null,
    accommodation_preference: payload.accommodation_preference || null,
    source: 'landing_page'
  };
}

async function saveWaitlistLead(payload) {
  const normalizedPayload = normalizeLeadPayload(payload);

  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    storage.set('nimbushaborWaitlistLead', JSON.stringify({ ...normalizedPayload, created_at: new Date().toISOString() }));
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
    move_in_preference: formData.get('moveIn'),
    accommodation_preference: formData.get('accommodationType')
  };
  storage.set('nimbushaborLatestSearch', JSON.stringify(latestSearch));
  showToast(`Early AI match saved: ${latestSearch.campus_preference}, ${latestSearch.budget_preference} budget preference, ${latestSearch.accommodation_preference}, ${latestSearch.move_in_preference}. Join the waitlist for launch access.`);
  document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setFormStatus('Your search preferences will be attached when you join the waitlist.', 'info');
  window.setTimeout(() => contactForm?.querySelector('input[name="name"]')?.focus(), 650);
});

contactForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(contactForm);
  if (formData.get('consent') !== 'on') {
    setFormStatus('Please confirm consent before joining the waitlist.', 'error');
    return;
  }

  const name = formData.get('name')?.toString() || 'there';
  const role = formData.get('role')?.toString() || 'supporter';
  const payload = {
    name,
    email: formData.get('email')?.toString() || '',
    phone: formData.get('phone')?.toString() || '',
    role,
    message: formData.get('message')?.toString() || '',
    ...latestSearch
  };

  setFormBusy(true);
  setFormStatus('Saving your interest...', 'loading');

  try {
    const result = await saveWaitlistLead(payload);
    contactForm.reset();
    const savedWhere = result.mode === 'supabase' ? 'Supabase waitlist' : 'local preview waitlist';
    const successMessage = `Thanks ${name}! Your ${role.toLowerCase()} interest is saved to the ${savedWhere}.`;
    setFormStatus(successMessage, 'success');
    showToast(successMessage);
  } catch (error) {
    storage.set('nimbushaborWaitlistLead', JSON.stringify({ ...normalizeLeadPayload(payload), created_at: new Date().toISOString() }));
    setFormStatus('Supabase is not reachable right now, so your Nimbus-Habor interest was saved locally for this preview.', 'warning');
    showToast('Supabase is not reachable right now, so your Nimbus-Habor interest was saved locally for this preview.');
  } finally {
    setFormBusy(false);
  }
});

function setCookieBannerVisibility(isVisible) {
  if (!cookieBanner) return;
  cookieBanner.hidden = !isVisible;
  cookieBanner.classList.toggle('is-visible', isVisible);
}

if (storage.get('nimbushaborCookieOK') !== 'true') {
  setCookieBannerVisibility(true);
}

function saveCookiePreference(message) {
  storage.set('nimbushaborCookieOK', 'true');
  if (cookieBanner) {
    cookieBanner.hidden = true;
    cookieBanner.classList.remove('is-visible');
  }
  showToast(message);
}

acceptCookies?.addEventListener('click', () => {
  saveCookiePreference('Cookie preference saved.');
});

dismissCookies?.addEventListener('click', () => {
  saveCookiePreference('Essential-only cookie preference saved.');
});

if (demoVideos.length) {
  if (prefersReducedMotion) {
    demoVideos.forEach((video) => {
      video.controls = true;
      video.pause();
    });
  } else if ('IntersectionObserver' in window) {
    const demoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
          const playPromise = video.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
              video.controls = true;
            });
          }
          return;
        }

        video.pause();
      });
    }, { threshold: [0, 0.4, 0.75] });

    demoVideos.forEach((video) => demoObserver.observe(video));
  } else {
    demoVideos.forEach((video) => {
      video.controls = true;
    });
  }
}

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
