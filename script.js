document.addEventListener('DOMContentLoaded', () => {
  const searchBar = document.getElementById('search-bar');
  const suggestionsContainer = document.getElementById('suggestions');
  const copyButton = document.getElementById('copy-button');
  const copyInput = document.getElementById('copy-input');
  const searchIcon = document.getElementById('search-icon');
  const aiIcon = document.getElementById('ai-icon');
  const siteInfo = document.getElementById('site-info');
  const flashtagsContainer = document.getElementById('flashtags-container');

  function debounce(func, timeout = 150) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
  }

  fetch('/sites.json')
    .then(response => response.json())
    .then(sites => {
      const performSearch = (query, useAI = false) => {
        if (useAI) {
          window.location.href = `/results?f=${encodeURIComponent(query)}&ai=true`;
        } else {
          const [searchTerm, alias] = query.split(' !');
          if (alias) {
            const site = sites.find(s => s.alias.includes(alias));
            if (site) {
              window.location.href = site.site + encodeURIComponent(searchTerm);
            } else {
              window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            }
          } else {
            window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query
