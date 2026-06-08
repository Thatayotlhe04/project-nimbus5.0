// chrome.js — cookie-consent banner (all pages) + shared footer (pages with #site-footer).
(function () {
  // ---- cookie consent ----
  function getCookie(n) { return document.cookie.split('; ').find((c) => c.startsWith(n + '='))?.split('=')[1]; }
  function setConsent(v) {
    document.cookie = `nimbus_cookie_consent=${v}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    const b = document.getElementById('nimbus-cookie-banner'); if (b) b.remove();
  }

  if (!getCookie('nimbus_cookie_consent')) {
    const style = document.createElement('style');
    style.textContent = `
      #nimbus-cookie-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:300;max-width:720px;margin:0 auto;
        background:#2E2520;color:#FAF6EC;border-radius:14px;padding:16px 18px;box-shadow:0 18px 40px rgba(63,47,34,.28);
        display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-family:'Manrope',system-ui,sans-serif;font-size:13.5px;line-height:1.5}
      #nimbus-cookie-banner a{color:#93A786;text-decoration:underline}
      #nimbus-cookie-banner .nb-actions{display:flex;gap:8px;margin-left:auto}
      #nimbus-cookie-banner button{border:none;cursor:pointer;border-radius:999px;padding:9px 16px;font-weight:600;font-size:13px;font-family:inherit}
      #nimbus-cookie-banner .nb-accept{background:#C97B5E;color:#fff}
      #nimbus-cookie-banner .nb-reject{background:transparent;color:#FAF6EC;border:1px solid rgba(250,246,236,.35)}`;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.id = 'nimbus-cookie-banner';
    el.innerHTML = `<div>We use a few cookies to keep you signed in, remember your A/B variant, and understand what’s working.
      See our <a href="/legal/cookies">Cookie Policy</a>.</div>
      <div class="nb-actions"><button class="nb-reject">Essential only</button><button class="nb-accept">Accept all</button></div>`;
    document.body.appendChild(el);
    el.querySelector('.nb-accept').addEventListener('click', () => setConsent('all'));
    el.querySelector('.nb-reject').addEventListener('click', () => setConsent('essential'));
  }

  // ---- shared footer (only where a placeholder exists) ----
  const slot = document.getElementById('site-footer');
  if (slot) {
    slot.outerHTML = `
    <footer class="site"><div class="container">
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:24px;align-items:start">
        <div>
          <div class="logo" style="margin-bottom:10px"><span class="logo-mark">N</span> Nimbus</div>
          <p class="muted" style="max-width:34ch">Verified, fairly-priced student housing in Gaborone — with escrow so your deposit is safe.</p>
        </div>
        <div><div style="font-weight:700;margin-bottom:8px">Product</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <a href="/browse">Browse homes</a><a href="/pricing">Pricing</a><a href="/landlord">For landlords</a><a href="/#how">How it works</a></div></div>
        <div><div style="font-weight:700;margin-bottom:8px">Company</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <a href="/about">About &amp; mission</a><a href="/#waitlist">Join waitlist</a></div></div>
        <div><div style="font-weight:700;margin-bottom:8px">Legal</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a><a href="/legal/cookies">Cookies</a></div></div>
      </div>
      <div style="border-top:1px solid var(--line);margin-top:22px;padding-top:16px;font-size:13px" class="muted">© 2026 Nimbus · Gaborone, Botswana</div>
    </div></footer>`;
  }
})();
