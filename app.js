const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('#navLinks');
const contactForm = document.querySelector('#contactForm');
const quickSearch = document.querySelector('#quickSearch');
const toast = document.querySelector('#toast');
const cookieBanner = document.querySelector('#cookieBanner');
const acceptCookies = document.querySelector('#acceptCookies');
const dismissCookies = document.querySelector('#dismissCookies');
const navAnchors = [...document.querySelectorAll('.nav-links a[href^="#"]')];

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
  const campus = formData.get('campus');
  const budget = formData.get('budget');
  const moveIn = formData.get('moveIn');
  showToast(`Early AI match saved: ${campus}, ${budget}, ${moveIn}. Join the waitlist for launch access.`);
  document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => contactForm?.querySelector('input[name="name"]')?.focus(), 650);
});

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(contactForm);
  const name = formData.get('name') || 'there';
  const role = formData.get('role') || 'supporter';
  contactForm.reset();
  showToast(`Thanks ${name}! Your ${role.toString().toLowerCase()} interest is on the Nimbus waitlist.`);
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
