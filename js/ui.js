export function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function setButtonLoading(button, isLoading, loadingText = 'Please wait…') {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.classList.add('is-loading');
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${escapeHtml(loadingText)}`;
  } else {
    button.disabled = false;
    button.classList.remove('is-loading');
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
    }
  }
}

export function setPanelLoading(container, isLoading, message = 'Loading…') {
  if (!container) return;
  let overlay = container.querySelector('.panel-loading-overlay');
  if (isLoading) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'panel-loading-overlay';
      overlay.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><p>${escapeHtml(message)}</p>`;
      container.appendChild(overlay);
    }
  } else if (overlay) {
    overlay.remove();
  }
}

export function setFieldError(inputEl, message) {
  clearFieldError(inputEl);
  if (!message) return;
  inputEl.classList.add('input-error');
  const err = document.createElement('div');
  err.className = 'field-error-msg';
  err.textContent = message;
  inputEl.insertAdjacentElement('afterend', err);
}

export function clearFieldError(inputEl) {
  inputEl.classList.remove('input-error');
  const next = inputEl.nextElementSibling;
  if (next && next.classList.contains('field-error-msg')) {
    next.remove();
  }
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

export function fireConfetti(durationMs = 1600) {
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const colors = ['#ff5e5e', '#ffd166', '#06d6a0', '#4cc9f0', '#c77dff', '#ff9f1c'];
  const pieces = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.4,
    r: 4 + Math.random() * 5,
    color: colors[Math.floor(Math.random() * colors.length)],
    vy: 2 + Math.random() * 3,
    vx: -2 + Math.random() * 4,
    rot: Math.random() * Math.PI,
    vr: -0.2 + Math.random() * 0.4
  }));

  const start = performance.now();

  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
      ctx.restore();
    });
    if (elapsed < durationMs) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(frame);
}

export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ---------- NEW: Social Share Renderer ----------

export function renderSocialShare(container, url, message) {
  if (!container) return;
  
  const encodedMsg = encodeURIComponent(message);
  const encodedUrl = encodeURIComponent(url);
  
  container.innerHTML = `
    <div class="social-share-banner">
      <p class="share-prompt"><i class="fa-solid fa-share-nodes"></i> Invite friends to rate you</p>
      <div class="social-share-buttons">
        <a href="https://wa.me/?text=${encodedMsg}%20${encodedUrl}" target="_blank" class="social-btn whatsapp" title="Share on WhatsApp">
          <i class="fa-brands fa-whatsapp"></i>
        </a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedMsg}" target="_blank" class="social-btn facebook" title="Share on Facebook">
          <i class="fa-brands fa-facebook-f"></i>
        </a>
        <a href="https://twitter.com/intent/tweet?text=${encodedMsg}&url=${encodedUrl}" target="_blank" class="social-btn twitter" title="Share on X / Twitter">
          <i class="fa-brands fa-x-twitter"></i>
        </a>
        <a href="https://t.me/share/url?url=${encodedUrl}&text=${encodedMsg}" target="_blank" class="social-btn telegram" title="Share on Telegram">
          <i class="fa-brands fa-telegram"></i>
        </a>
        <a href="mailto:?subject=Rate me on RateMe&body=${encodedMsg}%0A%0A${encodedUrl}" class="social-btn email" title="Share via Email">
          <i class="fa-solid fa-envelope"></i>
        </a>
        <button type="button" class="social-btn copy-link" title="Copy link" data-url="${escapeHtml(url)}">
          <i class="fa-solid fa-link"></i>
        </button>
      </div>
    </div>
  `;

  const copyBtn = container.querySelector('.copy-link');
  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard!', 'success', 2000);
    } catch {
      showToast('Failed to copy link', 'error');
    }
  });
}
