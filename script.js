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
    
    if (!resultsElement || !aiSummaryContent) return;
    
    // Clear existing content
    aiSummaryContent.innerHTML = '';
    
    // Show loading state
    if (loadingElement) loadingElement.style.display = 'flex';
    
    try {
      // Set up Server-Sent Events connection
      const eventSource = new EventSource(`https://api.coopr.tech:8148/flashtag-ai/stream?f=${encodeURIComponent(query)}`);
      
      // Stream processing state
      let summaryText = '';
      let hasResults = false;
      let lastProcessedLength = 0;
      let wordBuffer = [];
      
      // Handle the streamed data
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
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
          
          // Handle streamed content
          if (data.type === 'content' && data.text) {
            // Show AI summary div if this is first content
            if (summaryText === '') {
              if (aiSummaryElement) aiSummaryElement.style.display = 'block';
            }
            
            // Add the new text 
            const newText = data.text;
            summaryText += newText;
            
            // Process the new content word by word for animation
            const newWords = newText.split(/\s+/);
            wordBuffer = [...wordBuffer, ...newWords];
            
            // Only process a few words at a time to create a smooth typing effect
            const wordsToProcess = Math.min(3, wordBuffer.length);
            if (wordsToProcess > 0) {
              const processedWords = wordBuffer.splice(0, wordsToProcess);
              
              // Process highlights using __ markers for the entire text
              const processedText = highlightText(summaryText);
              
              // Update the content
              aiSummaryContent.innerHTML = processedText;
              
              // Animate only the newly added words
              animateNewWords(aiSummaryContent, processedWords);
            }
          }
          
          // End of stream
          if (data.type === 'end') {
            // Process any remaining words in buffer
            if (wordBuffer.length > 0) {
              const processedText = highlightText(summaryText);
              aiSummaryContent.innerHTML = processedText;
              animateNewWords(aiSummaryContent, wordBuffer);
              wordBuffer = [];
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
          if (event.data) {
            if (summaryText === '') {
              if (aiSummaryElement) aiSummaryElement.style.display = 'block';
            }
            
            // Add the raw text after sanitizing it
            const sanitizedText = event.data
              .replace(/^data:\s+/, '')
              .replace(/\{.*\}/, ''); // Remove any JSON-like structures
              
            if (sanitizedText.trim()) {
              summaryText += sanitizedText;
              aiSummaryContent.innerHTML = highlightText(summaryText);
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
  
  // Improved word animation function
  function animateNewWords(element, newWords) {
    // Find all text nodes that aren't inside highlight spans
    const textNodes = [];
    const findTextNodes = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        textNodes.push(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (!node.classList.contains('highlight')) {
          for (let i = 0; i < node.childNodes.length; i++) {
            findTextNodes(node.childNodes[i]);
          }
        }
      }
    };
    
    // Get the last text node (which would contain our new words)
    findTextNodes(element);
    if (textNodes.length === 0) return;
    
    const lastTextNode = textNodes[textNodes.length - 1];
    
    // Split the text into words
    const text = lastTextNode.textContent;
    const words = text.split(/(\s+)/);
    
    // Create a document fragment to hold our split words
    const fragment = document.createDocumentFragment();
    
    words.forEach((word, index) => {
      const span = document.createElement('span');
      span.textContent = word;
      
      // Check if this is one of our new words to animate
      // We check from the end since new words are appended
      if (index >= words.length - newWords.length * 2) { // *2 because of spaces
        span.style.opacity = '0';
        span.classList.add('animated-word');
        
        // Stagger the animation
        const wordsAlreadyAnimated = document.querySelectorAll('.animated-word').length;
        const delay = 0.08 * (index % newWords.length);
        span.style.transition = `opacity 0.25s ease ${delay}s`;
        
        // Start animation
        setTimeout(() => {
          span.style.opacity = '1';
        }, 10);
      }
      
      fragment.appendChild(span);
    });
    
    // Replace the text node with our fragment of spans
    if (lastTextNode.parentNode) {
      lastTextNode.parentNode.replaceChild(fragment, lastTextNode);
    }
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

      const urlParams = new URLSearchParams(window.location.search);
      const queryParam = urlParams.get('f');
      
      // If we're on the results page and have a query param, trigger streaming
      if (queryParam && window.location.pathname === '/results') {
        if (searchBar) searchBar.value = decodeURIComponent(queryParam);
        window.handleStreamingResponse(queryParam);
      }
      
      // If we're on the home page with a query, redirect to results
      if (queryParam && window.location.pathname !== '/results') {
        performSearch(queryParam);
      }

      // Event handlers
      const handleSearch = (useAI = true) => {
        const query = searchBar?.value.trim();
        if (!query) return;
        performSearch(query, useAI);
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

        fetch(`https://api.coopr.tech:8148/suggestions?q=${encodeURIComponent(query)}`)
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
