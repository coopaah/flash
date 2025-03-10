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
        if (!query.trim()) return;
        
        if (useAI) {
          window.location.href = `/results?f=${encodeURIComponent(query)}&ai=true`;
        } else {
          const [searchTerm, alias] = query.split(' !');
          if (alias) {
            const site = sites.find(s => s.alias.includes(alias));
            if (site) {
              window.location.href = `${site.site}${encodeURIComponent(searchTerm)}`;
            } else {
              window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            }
          } else {
            window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
          }
        }
      };

      const urlParams = new URLSearchParams(window.location.search);
      const queryParam = urlParams.get('f');
      if (queryParam) {
        performSearch(queryParam);
      }

      const handleInput = debounce(() => {
        const query = searchBar.value;
        const [searchTerm, alias] = query.split(' !');
        
        if (alias) {
          const site = sites.find(s => s.alias.includes(alias));
          siteInfo.textContent = site ? `Searching on ${site.title}` : '';
          siteInfo.style.display = site ? 'block' : 'none';
          suggestionsContainer.innerHTML = '';
        } else {
          siteInfo.textContent = '';
          siteInfo.style.display = 'none';
          
          if (query.length > 0) {
            fetch(`https://api.coopr.tech:8148/suggestions?q=${query}`)
              .then(response => response.json())
              .then(data => {
                suggestionsContainer.innerHTML = data.suggestions
                  .map(suggestion => `<div class="suggestion">${suggestion}</div>`)
                  .join('');
              })
              .catch(console.error);
          } else {
            suggestionsContainer.innerHTML = '';
          }
        }
      });

      searchBar?.addEventListener('input', handleInput);

      searchBar?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          performSearch(searchBar.value);
        }
      });

      searchIcon?.addEventListener('click', () => {
        performSearch(searchBar.value);
      });

      aiIcon?.addEventListener('click', () => {
        performSearch(searchBar.value, true);
      });

      suggestionsContainer?.addEventListener('click', (event) => {
        if (event.target.classList.contains('suggestion')) {
          searchBar.value = event.target.textContent;
          suggestionsContainer.innerHTML = '';
          performSearch(searchBar.value);
        }
      });

      copyButton?.addEventListener('click', () => {
        navigator.clipboard.writeText(copyInput.value)
          .then(() => alert('Link copied to clipboard!'))
          .catch(err => console.error('Copy failed:', err));
      });

      if (flashtagsContainer) {
        sites.forEach(site => {
          site.alias.forEach(alias => {
            const flashtag = document.createElement('div');
            flashtag.className = 'flashtag';
            flashtag.textContent = `!${alias}`;
            flashtag.addEventListener('click', () => {
              window.location.href = `/results?f=!${alias}`;
            });
            flashtagsContainer.appendChild(flashtag);
          });
        });
      }
    })
    .catch(error => {
      console.error('Error loading sites:', error);
      siteInfo.textContent = 'Error loading search providers';
    });
});
