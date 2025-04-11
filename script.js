document.addEventListener('DOMContentLoaded', () => {
  const searchBar = document.getElementById('search-bar');
  const suggestionsContainer = document.getElementById('suggestions');
  const searchIcon = document.getElementById('search-icon');
  const aiIcon = document.getElementById('ai-icon');
  const siteInfo = document.getElementById('site-info');

  function debounce(func, timeout = 150) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), timeout);
    };
  }

  // Handle streaming responses from server
  window.handleStreamingResponse = async (query) => {
    const resultsElement = document.getElementById('results');
    const aiSummaryContent = document.getElementById('ai-summary-content');
    const loadingElement = document.getElementById('loading');
    const aiSummaryElement = document.getElementById('ai-summary');
    const thinkingContent = document.getElementById('thinking-content');
    const refinedQueries = document.getElementById('refined-queries');
    const queryChips = document.getElementById('query-chips');
    
    if (!resultsElement || !aiSummaryContent) return;
    
    // Clear existing content
    aiSummaryContent.innerHTML = '';
    if (thinkingContent) thinkingContent.innerHTML = '';
    if (queryChips) queryChips.innerHTML = '';
    if (refinedQueries) refinedQueries.style.display = 'none';
    
    // Show loading state
    if (loadingElement) loadingElement.style.display = 'flex';
    
    try {
      // Set up Server-Sent Events connection
      const eventSource = new EventSource(`https://api.coopr.tech:8148/flashtag-ai/stream?f=${encodeURIComponent(query)}`);
      
      // Stream processing state
      let summaryText = '';
      let hasResults = false;
      let newWords = [];
      let animationQueue = [];
      let isProcessing = false;
      let allThoughts = [];
      
      // Function to process animation queue
      const processAnimationQueue = () => {
        if (isProcessing || animationQueue.length === 0) return;
        
        isProcessing = true;
        const nextChunk = animationQueue.shift();
        
        // Process highlights using __ markers for the entire text
        const processedText = highlightText(summaryText);
        
        // Update the content
        aiSummaryContent.innerHTML = processedText;
        
        // Animate the new words
        animateWords(aiSummaryContent, nextChunk);
        
        // Continue processing the queue after a short delay
        setTimeout(() => {
          isProcessing = false;
          if (animationQueue.length > 0) {
            processAnimationQueue();
          }
        }, 50);
      };
      
      // Handle the streamed data
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle refined queries
          if (data.type === 'refined_queries' && data.queries && data.queries.length > 0) {
            if (refinedQueries && queryChips) {
              refinedQueries.style.display = 'block';
              data.queries.forEach(query => {
                const chip = document.createElement('div');
                chip.className = 'query-chip';
                chip.textContent = query;
                chip.addEventListener('click', () => {
                  // Set search bar to this query and trigger a new search
                  if (searchBar) searchBar.value = query;
                  window.handleStreamingResponse(query);
                });
                queryChips.appendChild(chip);
              });
            }
          }
          
          // Handle search results
          if (data.type === 'results' && data.results) {
            hasResults = true;
            if (loadingElement) loadingElement.style.display = 'none';
            
            resultsElement.innerHTML = '';
            data.results.forEach((result, index) => {
              const resultElement = document.createElement('div');
              resultElement.className = 'result';
              resultElement.style.animationDelay = `${index * 0.1}s`;
              
              resultElement.innerHTML = `
                <a href="${result.result_url}" class="result-title">${result.result_title}</a>
                <div class="result-url">${new URL(result.result_url).hostname}</div>
                <div class="result-description">${result.result_og_description || ''}</div>
              `;
              
              resultsElement.appendChild(resultElement);
            });
          }
          
          // Handle thinking process
          if (data.type === 'thinking' && data.thought) {
            if (thinkingContent) {
              const thoughtElement = document.createElement('div');
              thoughtElement.className = 'thinking-item';
              thoughtElement.textContent = data.thought;
              thinkingContent.appendChild(thoughtElement);
              allThoughts.push(data.thought);
            }
          }
          
          // Handle thinking complete (full thoughts)
          if (data.type === 'thinking_complete' && data.thoughts) {
            if (thinkingContent) {
              // Replace with complete thoughts for better formatting
              thinkingContent.innerHTML = '';
              data.thoughts.forEach(thought => {
                const thoughtElement = document.createElement('div');
                thoughtElement.className = 'thinking-item';
                thoughtElement.textContent = thought;
                thinkingContent.appendChild(thoughtElement);
              });
              allThoughts = data.thoughts;
            }
          }
          
          // Handle streamed content
          if (data.type === 'content' && data.text) {
            // Show AI summary div if this is first content
            if (summaryText === '') {
              if (aiSummaryElement) aiSummaryElement.style.display = 'block';
            }
            
            // Add the new text 
            const newText = data.text;
            summaryText += newText;
            
            // Split the new text into words and add to animation queue
            const words = newText.split(/\s+/).filter(word => word.trim().length > 0);
            if (words.length > 0) {
              animationQueue.push(words);
              if (!isProcessing) {
                processAnimationQueue();
              }
            }
          }
          
          // End of stream
          if (data.type === 'end') {
            // Process any remaining words in queue
            if (!isProcessing && animationQueue.length > 0) {
              processAnimationQueue();
            }
            eventSource.close();
          }
          
          // Handle errors
          if (data.type === 'error') {
            aiSummaryContent.innerHTML = `<p>${data.message}</p>`;
            eventSource.close();
          }
        } catch (e) {
          console.error('Error parsing server event:', e);
          // If JSON parsing fails, try to handle it as plain text
          if (event.data && typeof event.data === 'string') {
            console.log('Received non-JSON data:', event.data);
            if (summaryText === '') {
              if (aiSummaryElement) aiSummaryElement.style.display = 'block';
            }
            
            try {
              // Try to extract content from the raw string
              const contentMatch = event.data.match(/data: (.+)/);
              if (contentMatch && contentMatch[1]) {
                const cleanedText = contentMatch[1].replace(/^\s*{\s*".*?":\s*"(.*?)"\s*}\s*$/, '$1');
                if (cleanedText) {
                  summaryText += cleanedText;
                  aiSummaryContent.innerHTML = highlightText(summaryText);
                }
              }
            } catch (parseError) {
              console.error('Error parsing data content:', parseError);
            }
          }
        }
      };
      
      // Error handling
      eventSource.onerror = () => {
        if (loadingElement) loadingElement.style.display = 'none';
        
        if (!hasResults) {
          resultsElement.innerHTML = '<div class="result">Error loading results</div>';
        }
        
        if (summaryText === '') {
          aiSummaryContent.innerHTML = '<p>Sorry, I encountered an issue processing your request.</p>';
        }
        
        eventSource.close();
      };
      
    } catch (error) {
      console.error('Error:', error);
      if (loadingElement) loadingElement.style.display = 'none';
      aiSummaryContent.innerHTML = '<p>Sorry, I encountered an issue processing your request.</p>';
    }
  };
  
  // Optimized word animation function
  function animateWords(element, newWords) {
    if (!newWords || newWords.length === 0) return;
    
    // Create a new span for each word with staggered animation
    const container = document.createElement('span');
    container.className = 'animated-word-container';
    
    newWords.forEach((word, index) => {
      const wordSpan = document.createElement('span');
      wordSpan.textContent = word + ' ';
      wordSpan.className = 'animated-word';
      wordSpan.style.opacity = '0';
      wordSpan.style.transition = `opacity 0.2s ease ${index * 0.05}s`;
      container.appendChild(wordSpan);
      
      // Start the fade-in animation
      setTimeout(() => {
        wordSpan.style.opacity = '1';
      }, 10);
    });
    
    // Append the new words to the content
    element.appendChild(container);
    
    // Replace underscores with highlight spans in the new content
    const highlightedElements = element.querySelectorAll('.animated-word-container');
    highlightedElements.forEach(el => {
      el.innerHTML = el.innerHTML.replace(/__(.*?)__/g, '<span class="highlight">$1</span>');
    });
  }
  
  // Text highlighting function
  function highlightText(text) {
    return text.replace(/__(.*?)__/g, '<span class="highlight">$1</span>');
  }

  // Load sites for search suggestions
  fetch('/sites.json')
    .then(response => response.json())
    .then(sites => {
      const performSearch = (query, useAI = true) => {
        // For all searches, we now use the streaming API
        if (window.location.pathname !== '/results') {
          window.location.href = `/results?f=${encodeURIComponent(query)}&ai=true`;
        } else {
          // If we're already on results page, handle the search directly
          window.handleStreamingResponse(query);
        }
      };

      const performFlashtagSearch = (query) => {
        // Parse the query to check for flashtags
        const [searchTerm, tag] = query.split(' !');
        
        if (tag) {
          // Found a flashtag, try to match with a site
          const site = sites.find(s => s.alias.includes(tag));
          if (site) {
            // Navigate to the target site with the search term
            window.location.href = site.site + encodeURIComponent(searchTerm);
            return true;
          }
        }
        return false;
      };

      const urlParams = new URLSearchParams(window.location.search);
      const queryParam = urlParams.get('f');
      
      // If we're on the results page and have a query param, trigger streaming
      if (queryParam && window.location.pathname === '/results') {
        if (searchBar) searchBar.value = decodeURIComponent(queryParam);
        
        // Check if it's a flashtag query first
        if (!performFlashtagSearch(decodeURIComponent(queryParam))) {
          window.handleStreamingResponse(queryParam);
        }
      }
      
      // If we're on the home page with a query, redirect to results
      if (queryParam && window.location.pathname !== '/results') {
        // Check if it's a flashtag query first
        if (!performFlashtagSearch(decodeURIComponent(queryParam))) {
          performSearch(queryParam);
        }
      }

      // Event handlers
      const handleSearch = (useAI = true) => {
        const query = searchBar?.value.trim();
        if (!query) return;
        
        // Check for flashtags first, otherwise perform normal search
        if (!performFlashtagSearch(query)) {
          performSearch(query, useAI);
        }
      };

      searchBar?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
      });

      searchIcon?.addEventListener('click', () => handleSearch());
      aiIcon?.addEventListener('click', () => handleSearch(true));

      // Suggestions
      const updateSuggestions = debounce(() => {
        const query = searchBar?.value;
        if (!query || !suggestionsContainer) {
          if (suggestionsContainer) suggestionsContainer.innerHTML = '';
          return;
        }

        fetch(`https://api.coopr.tech:8148/flashtag-ai/autocomplete?q=${encodeURIComponent(query)}`)
          .then(response => response.json())
          .then(data => {
            if (suggestionsContainer) {
              suggestionsContainer.innerHTML = data.suggestions
                ?.map(s => `<div class="suggestion">${s}</div>`)
                .join('') || '';
            }
          })
          .catch(console.error);
      });

      searchBar?.addEventListener('input', updateSuggestions);

      // Flashtag detection
      const checkFlashtag = debounce(() => {
        if (!searchBar || !siteInfo) return;
        
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
      if (siteInfo) siteInfo.textContent = 'Error loading search providers';
    });
    
  // Add custom event handlers for results page elements
  if (window.location.pathname === '/results') {
    // Handle refresh or reload with query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('f');
    
    if (queryParam && searchBar) {
      searchBar.value = decodeURIComponent(queryParam);
    }
  }
});
