document.addEventListener('DOMContentLoaded', () => {
  const searchBar = document.getElementById('search-bar');
  const suggestionsContainer = document.getElementById('suggestions');
  const searchIcon = document.getElementById('search-icon');
  const aiIcon = document.getElementById('ai-icon');
  const siteInfo = document.getElementById('site-info');


if ('serviceWorker' in navigator) {
    const overlay = document.getElementById('installing-overlay');
    window.addEventListener('load', () => {
      overlay.style.display = 'flex';
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
          overlay.style.display = 'none';
        })
        .catch(error => {
          console.log('ServiceWorker registration failed: ', error);
          overlay.style.display = 'none';
        });
    });
  }


  
  function debounce(func, timeout = 150) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), timeout);
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
              window.location.href = `/results?f=${encodeURIComponent(query)}&ai=true`;
            }
          } else {
            window.location.href = `/results?f=${encodeURIComponent(query)}&ai=true`;
          }
        }
      };

      const urlParams = new URLSearchParams(window.location.search);
      const queryParam = urlParams.get('f');
      if (queryParam && !window.location.pathname.includes('/results')) {
        performSearch(queryParam);
      }

      // Event handlers
      const handleSearch = (useAI = false) => {
        performSearch(searchBar.value, useAI);
      };

      searchBar?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
      });

      searchIcon?.addEventListener('click', () => handleSearch());
      aiIcon?.addEventListener('click', () => handleSearch(true));

      // Suggestions
      const updateSuggestions = debounce(() => {
        const query = searchBar.value;
        if (!query) {
          suggestionsContainer.innerHTML = '';
          return;
        }

        fetch(`https://api.coopr.tech:8148/suggestions?q=${encodeURIComponent(query)}`)
          .then(response => response.json())
          .then(data => {
            suggestionsContainer.innerHTML = data.suggestions
              .map(s => `<div class="suggestion">${s}</div>`)
              .join('');
          })
          .catch(console.error);
      });

      searchBar?.addEventListener('input', updateSuggestions);

      // Flashtag detection
      const checkFlashtag = debounce(() => {
        const query = searchBar.value;
        const [, alias] = query.split(/ !(.*)/);
        if (alias) {
          const site = sites.find(s => s.alias.includes(alias));
          siteInfo.textContent = site ? `Searching ${site.title}` : '';
          siteInfo.style.display = 'block';
        } else {
          siteInfo.style.display = 'none';
        }
      }, 100);

      searchBar?.addEventListener('input', checkFlashtag);
    })
    .catch(error => {
      console.error('Error loading sites:', error);
      siteInfo.textContent = 'Error loading search providers';
    });
});
