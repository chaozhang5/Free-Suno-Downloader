export function scrollToSection(id: string) {
  if (window.location.hash) {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }
  document.getElementById(id)?.scrollIntoView({ block: 'start' });
}
