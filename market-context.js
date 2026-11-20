export function marketContexts() {
  let shown;

  function close() {
    if (!shown) return;
    const { card, front, back, contextButton } = shown;
    shown = null;
    const restoreFocus = back.contains(document.activeElement);
    front.hidden = false;
    back.hidden = true;
    card.classList.remove('is-context-open');
    contextButton.setAttribute('aria-expanded', 'false');
    if (restoreFocus) contextButton.focus();
  }

  function open(slot) {
    if (shown === slot) return;
    close();
    shown = slot;
    const { card, front, back, contextButton, backButton, prepareContext } = slot;
    prepareContext();
    front.hidden = true;
    back.hidden = false;
    card.classList.add('is-context-open');
    contextButton.setAttribute('aria-expanded', 'true');
    backButton.focus();
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  function bind(slot) {
    slot.back.hidden = true;
    slot.contextButton.addEventListener('click', () => open(slot));
    slot.backButton.addEventListener('click', close);
  }

  return { bind, close };
}
