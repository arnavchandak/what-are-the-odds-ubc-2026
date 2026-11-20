export function marketContexts() {
  let shown;
  function flip(slot, open) {
    const { card, front, back, contextButton, backButton } = slot;
    slot.finishFlip?.();
    const [from,to] = open ? [front,back] : [back,front];
    const focus = from.contains(document.activeElement);
    to.hidden = false;
    to.inert = false;
    from.inert = true;
    contextButton.setAttribute('aria-expanded', String(open));
    card.classList.toggle('is-context-open',open);
    if (focus || open) (open ? backButton : contextButton).focus({preventScroll:true});
    if (open) card.scrollIntoView({block:'nearest'});
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { from.hidden = true; return; }
    Object.assign(from.style,{position:'absolute',inset:'0 0 auto',pointerEvents:'none'});
    const sign = open ? 1 : -1;
    const turn = angle => 'perspective(800px) rotateY(' + angle * sign + 'deg)';
    const outgoing = from.animate([{transform:turn(0)}, {transform:turn(-90)}],{duration:125,fill:'forwards',easing:'ease-in'});
    const incoming = to.animate([{transform:turn(90)}, {transform:turn(0)}],{delay:125,duration:145,fill:'both',easing:'ease-out'});
    const finish = () => {
      from.hidden = true;
      from.style.removeProperty('position');
      from.style.removeProperty('inset');
      from.style.removeProperty('pointer-events');
      incoming.onfinish = null;
      incoming.cancel();
      outgoing.cancel();
      slot.finishFlip = null;
    };
    slot.finishFlip = finish;
    incoming.onfinish = finish;
  }
  function close() {
    if (!shown) return;
    flip(shown,false);
    shown = null;
  }
  function open(slot) {
    if (shown === slot) return;
    close();
    slot.prepareContext();
    shown = slot;
    flip(slot,true);
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !shown?.back.querySelector('dialog[open]')) close();
  });
  function bind(slot) {
    slot.back.hidden = true;
    slot.contextButton.onclick = () => open(slot);
    slot.backButton.onclick = close;
  }
  return { bind, close };
}
