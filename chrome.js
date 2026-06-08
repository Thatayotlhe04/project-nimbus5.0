// chrome.js — cookie-consent banner (all pages) + shared footer (pages with #site-footer).
(function () {
  // ---- cookie consent ----
  function getCookie(n) { return document.cookie.split('; ').find((c) => c.startsWith(n + '='))?.split('=')[1]; }
  function setConsent(v) {
    document.cookie = `nimbus_cookie_consent=${v}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setPandoraModelTraining(v === 'continued');
    const b = document.getElementById('nimbus-cookie-banner'); if (b) b.remove();
  }
  async function setPandoraModelTraining(enabled) {
    document.cookie = `nimbus_pandora_model_training=${enabled ? 'on' : 'off'}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    try {
      await fetch('/api/pandora/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_training: enabled })
      });
    } catch {}
  }

  if (!getCookie('nimbus_cookie_consent')) {
    const style = document.createElement('style');
    style.textContent = `
      #nimbus-cookie-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:300;max-width:560px;margin:0 auto;
        background:#fff;color:#201B17;border:1px solid rgba(63,47,34,.12);border-radius:22px;padding:20px;box-shadow:0 20px 56px rgba(63,47,34,.24);
        font-family:'Manrope',system-ui,sans-serif;font-size:16px;line-height:1.5}
      #nimbus-cookie-banner a{color:inherit;text-decoration:underline;text-underline-offset:3px}
      #nimbus-cookie-banner .nb-actions{display:flex;gap:10px;margin-top:18px}
      #nimbus-cookie-banner button{cursor:pointer;border-radius:14px;padding:12px 20px;font-weight:700;font-size:15px;font-family:inherit}
      #nimbus-cookie-banner .nb-accept{background:#201B17;color:#fff;border:1px solid #201B17}
      #nimbus-cookie-banner .nb-reject{background:#fff;color:#201B17;border:1px solid rgba(63,47,34,.2)}`;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.id = 'nimbus-cookie-banner';
    el.innerHTML = `<div>We use cookies to improve Nimbus and build better AI systems. You can opt out of model-training cookies. See our <a href="/legal/cookies">Cookie Policy</a>.</div>
      <div class="nb-actions"><button class="nb-accept">Continue</button><button class="nb-reject">Reject</button></div>`;
    document.body.appendChild(el);
    el.querySelector('.nb-accept').addEventListener('click', () => setConsent('continued'));
    el.querySelector('.nb-reject').addEventListener('click', () => setConsent('rejected'));
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
