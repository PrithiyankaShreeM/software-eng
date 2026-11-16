/* ==========================================================================
   UniExam — client-side behaviour
   Progressive enhancement only: every feature degrades gracefully.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------ Helpers ------------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function toast(message) {
    const host = $('#toastHost');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5 9 17 19.5 6.5"/></svg>' +
      '<span></span>';
    el.querySelector('span').textContent = message;
    host.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      el.style.transition = 'all 200ms ease';
      setTimeout(() => el.remove(), 220);
    }, 2600);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  /* --------------------------- Dismiss alerts --------------------------- */
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-dismiss]');
    if (!btn) return;
    const alert = btn.closest('.alert');
    if (alert) {
      alert.style.transition = 'opacity 150ms ease, transform 150ms ease';
      alert.style.opacity = '0';
      alert.style.transform = 'translateY(-4px)';
      setTimeout(() => alert.remove(), 160);
    }
  });

  /* ------------------------- Password visibility ------------------------ */
  $$('[data-password-toggle]').forEach((btn) => {
    const targetId = btn.getAttribute('data-password-toggle');
    const input = document.getElementById(targetId);
    if (!input) return;

    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      btn.setAttribute('title', show ? 'Hide password' : 'Show password');
      const eyeShow = btn.querySelector('[data-eye-show]');
      const eyeHide = btn.querySelector('[data-eye-hide]');
      if (eyeShow) eyeShow.hidden = show;
      if (eyeHide) eyeHide.hidden = !show;
      // Keep the caret where the user left it.
      const pos = input.value.length;
      input.focus();
      try { input.setSelectionRange(pos, pos); } catch { /* not all inputs support this */ }
    });
  });

  /* ---------------------------- Caps Lock ------------------------------ */
  const capsWarn = $('#capsWarning');
  const pwField = $('#password');
  if (capsWarn && pwField) {
    const update = (event) => {
      if (typeof event.getModifierState !== 'function') return;
      capsWarn.classList.toggle('is-active', event.getModifierState('CapsLock'));
    };
    pwField.addEventListener('keydown', update);
    pwField.addEventListener('keyup', update);
    pwField.addEventListener('blur', () => capsWarn.classList.remove('is-active'));
  }

  /* --------------------- Portal tabs + help text ----------------------- */
  const PORTAL_HINTS = {
    student: {
      note: 'Use your Student ID (for example <strong>STU2024001</strong>) and your portal password.',
      hint: 'Student ID — printed on your hall ticket, e.g. STU2024001',
      placeholder: 'e.g. STU2024001',
    },
    staff: {
      note: 'For examiners, moderators, controllers and department heads. Your role determines which dashboard opens.',
      hint: 'Staff ID issued by the examination office, e.g. EXM1001',
      placeholder: 'e.g. EXM1001',
    },
    administrator: {
      note: 'Restricted to platform administrators. All administrative actions are audited.',
      hint: 'Administrator username, e.g. admin',
      placeholder: 'e.g. admin',
    },
    verifier: {
      note: 'For approved external agencies verifying degree certificates. Only permitted credential fields are disclosed.',
      hint: 'Organisation verifier ID, e.g. VER5001',
      placeholder: 'e.g. VER5001',
    },
  };

  const identifierInput = $('#identifier');
  const hintEl = $('[data-identifier-hint]');
  const noteEl = $('[data-portal-note-text]');

  function applyPortal(category) {
    const cfg = PORTAL_HINTS[category];
    if (!cfg) return;
    if (noteEl) noteEl.innerHTML = cfg.note;
    if (hintEl) hintEl.textContent = cfg.hint;
    if (identifierInput && !identifierInput.value) identifierInput.placeholder = cfg.placeholder;
  }

  const portalRadios = $$('[data-portal-radio]');
  portalRadios.forEach((radio) => {
    radio.addEventListener('change', () => applyPortal(radio.value));
  });
  const checkedPortal = portalRadios.find((r) => r.checked);
  if (checkedPortal) applyPortal(checkedPortal.value);

  /* ------------------- Demo credential quick-fill ---------------------- */
  $$('[data-demo-fill]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const identifier = btn.getAttribute('data-demo-fill');
      const portal = btn.getAttribute('data-demo-portal');
      if (identifierInput) {
        identifierInput.value = identifier;
        identifierInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const portalRadio = document.querySelector(`[data-portal-radio][value="${portal}"]`);
      if (portalRadio) {
        portalRadio.checked = true;
        applyPortal(portal);
      }
      const pw = $('#password');
      if (pw) pw.focus();
      toast(`Demo account "${identifier}" filled — enter the demo password.`);
    });
  });

  /* Copy demo user IDs on click of the copy affordance is handled above;
     the password chip copies itself. */
  $$('[data-copy]').forEach((el) => {
    el.addEventListener('click', async () => {
      const value = el.getAttribute('data-copy');
      const ok = await copyText(value);
      toast(ok ? 'Copied to clipboard' : 'Press Ctrl+C to copy');
    });
  });

  /* --------------------- Demo guide collapse --------------------------- */
  const guideToggle = $('[data-demo-guide-toggle]');
  const guide = $('#demoGuide');
  if (guideToggle && guide) {
    const label = guideToggle.querySelector('[data-demo-guide-label]');
    // Collapsed by default on small screens to keep the form above the fold.
    const startOpen = window.matchMedia('(min-width: 1080px)').matches;
    const setOpen = (open) => {
      guide.hidden = !open;
      guideToggle.setAttribute('aria-expanded', String(open));
      if (label) label.textContent = open ? 'Hide demo accounts' : 'Demo accounts';
    };
    setOpen(startOpen);
    guideToggle.addEventListener('click', () => setOpen(guide.hidden));
  }

  /* ------------------------ Password strength -------------------------- */
  const strengthInput = $('[data-pw-strength]');
  const meter = $('[data-pw-meter]');
  const meterLabel = $('[data-pw-label]');

  if (strengthInput && meter) {
    const score = (value) => {
      let s = 0;
      if (value.length >= 10) s += 1;
      if (/[a-z]/.test(value) && /[A-Z]/.test(value)) s += 1;
      if (/\d/.test(value)) s += 1;
      if (/[^A-Za-z0-9]/.test(value) || value.length >= 16) s += 1;
      return Math.min(s, 4);
    };
    const LABELS = ['Too weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
    strengthInput.addEventListener('input', () => {
      const value = strengthInput.value;
      meter.hidden = value.length === 0;
      const s = value.length === 0 ? 0 : Math.max(1, score(value));
      meter.setAttribute('data-score', String(s));
      if (meterLabel) meterLabel.textContent = LABELS[s] || '';
    });
  }

  const confirmInput = $('[data-pw-confirm]');
  const matchWarning = $('[data-pw-match]');
  if (confirmInput && strengthInput && matchWarning) {
    const check = () => {
      const mismatch = confirmInput.value.length > 0 && confirmInput.value !== strengthInput.value;
      matchWarning.hidden = !mismatch;
      confirmInput.setAttribute('aria-invalid', String(mismatch));
    };
    confirmInput.addEventListener('input', check);
    strengthInput.addEventListener('input', check);
  }

  /* ---------------------- Submit button loading ----------------------- */
  $$('form').forEach((form) => {
    form.addEventListener('submit', () => {
      const btn = form.querySelector('[data-submit-btn]');
      if (btn && form.checkValidity()) {
        btn.classList.add('is-loading');
        btn.setAttribute('aria-busy', 'true');
      }
    });
  });

  /* --------------------------- Sidebar toggle ------------------------- */
  const sidebar = $('#sidebar');
  const scrim = $('[data-sidebar-scrim]');
  const sidebarToggle = $('[data-sidebar-toggle]');

  function setSidebar(open) {
    if (!sidebar) return;
    sidebar.classList.toggle('is-open', open);
    if (scrim) scrim.classList.toggle('is-open', open);
    if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  if (sidebarToggle) sidebarToggle.addEventListener('click', () => setSidebar(!sidebar.classList.contains('is-open')));
  if (scrim) scrim.addEventListener('click', () => setSidebar(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setSidebar(false);
  });

  /* ------------------------------ Modals ------------------------------ */
  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    const focusable = modal.querySelector('input, select, textarea, button');
    if (focusable) setTimeout(() => focusable.focus(), 60);
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  $$('[data-modal-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-modal-open');
      // Optionally prefill fields: data-modal-field-name="value"
      const modal = document.getElementById(id);
      if (modal) {
        Array.from(btn.attributes).forEach((attr) => {
          if (attr.name.startsWith('data-modal-set-')) {
            const fieldName = attr.name.replace('data-modal-set-', '');
            const field = modal.querySelector(`[name="${fieldName}"]`);
            if (field) field.value = attr.value;
          }
        });
        const fills = btn.getAttribute('data-modal-prefill');
        if (fills) {
          try {
            const map = JSON.parse(fills);
            Object.entries(map).forEach(([name, value]) => {
              const field = modal.querySelector(`[name="${name}"]`);
              if (field) field.value = value;
            });
          } catch { /* ignore malformed prefill */ }
        }
      }
      openModal(id);
    });
  });

  $$('[data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.closest('.modal-overlay')));
  });

  $$('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeModal(overlay);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      $$('.modal-overlay.is-open').forEach(closeModal);
    }
  });

  /* ------------------------------- Tabs ------------------------------- */
  $$('[data-tabs]').forEach((group) => {
    const buttons = $$('[data-tab-target]', group);
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab-target');
        buttons.forEach((b) => {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-selected', String(b === btn));
        });
        $$('[data-tab-panel]', document).forEach((panel) => {
          if (panel.getAttribute('data-tab-panel').startsWith(group.getAttribute('data-tabs') + ':')) {
            panel.classList.toggle('is-active', panel.getAttribute('data-tab-panel') === target);
          }
        });
      });
    });
  });

  /* ------------------------ Confirm destructive ----------------------- */
  $$('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      const message = form.getAttribute('data-confirm') || 'Are you sure?';
      if (!window.confirm(message)) {
        event.preventDefault();
        const btn = form.querySelector('[data-submit-btn]');
        if (btn) btn.classList.remove('is-loading');
      }
    });
  });

  /* ----------------------- Empty search feedback ---------------------- */
  const filterInputs = $$('[data-filter-input]');
  filterInputs.forEach((input) => {
    const tableSel = input.getAttribute('data-filter-input');
    const table = document.querySelector(tableSel);
    if (!table) return;
    input.addEventListener('input', () => {
      const needle = input.value.trim().toLowerCase();
      let visible = 0;
      $$('tbody tr', table).forEach((row) => {
        const match = needle === '' || row.textContent.toLowerCase().includes(needle);
        row.hidden = !match;
        if (match) visible += 1;
      });
      const empty = document.querySelector(input.getAttribute('data-filter-empty') || '');
      if (empty) empty.hidden = visible !== 0;
    });
  });

  /* --------------------- Expose copy helper for inline use ------------- */
  window.UniExam = { toast, copyText, openModal, closeModal };
})();
