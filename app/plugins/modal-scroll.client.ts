export default defineNuxtPlugin((nuxtApp) => {
  let restore: (() => void) | undefined;
  function sync() {
    const modalOpen = Boolean(document.querySelector('dialog:modal'));
    if (modalOpen && !restore) {
      const x = window.scrollX;
      const y = window.scrollY;
      const body = document.body;
      const root = document.documentElement;
      const styles = [
        [body, 'position', 'fixed'],
        [body, 'top', `${-y}px`],
        [body, 'left', `${-x}px`],
        [body, 'width', '100%'],
        [root, 'overflow', 'hidden'],
      ] as const;
      const previous = styles.map(([element, property]) => ({
        element,
        property,
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property),
      }));
      restore = () => {
        for (const { element, property, value, priority } of previous) {
          if (value) element.style.setProperty(property, value, priority);
          else element.style.removeProperty(property);
        }
        window.scrollTo({ left: x, top: y, behavior: 'instant' });
      };
      for (const [element, property, value] of styles) element.style.setProperty(property, value);
    } else if (!modalOpen && restore) {
      restore();
      restore = undefined;
    }
  }
  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['open'],
  });
  sync();
  nuxtApp.vueApp.onUnmount(() => {
    observer.disconnect();
    restore?.();
  });
});
