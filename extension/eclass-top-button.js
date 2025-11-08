// eclass-top-button.js
// Adds e-class top page button next to scroll Top button and centers both buttons

(function() {
  'use strict';

  console.log('[BetterE-class] E-class top button script initialized');

  // Find the scroll Top button
  const topButton = document.querySelector('button[onclick="scrollGoTop()"]');

  if (!topButton) {
    console.log('[BetterE-class] Scroll Top button not found');
    return;
  }

  console.log('[BetterE-class] Found scroll Top button');

  // Get the parent container
  const container = topButton.parentElement;

  if (!container) {
    console.warn('[BetterE-class] Parent container not found');
    return;
  }

  // Center the container more precisely
  // The container is inside a Bootstrap column, so we need to compensate
  container.style.textAlign = 'center';
  container.style.display = 'flex';
  container.style.justifyContent = 'center';
  container.style.gap = '10px';
  container.style.marginBottom = '1em';
  container.style.width = '100%';
  container.style.paddingLeft = '0';
  container.style.paddingRight = '0';

  // Move buttons slightly to the left to account for the Bootstrap grid offset
  container.style.transform = 'translateX(-60px)';

  console.log('[BetterE-class] Container styles applied');

  // Create e-class top button
  const eclassTopButton = document.createElement('button');
  eclassTopButton.type = 'button';
  eclassTopButton.className = 'btn btn-default';
  eclassTopButton.textContent = 'E-class Top';

  eclassTopButton.addEventListener('click', () => {
    console.log('[BetterE-class] E-class Top button clicked');
    window.location.href = 'https://eclass.doshisha.ac.jp/webclass/';
  });

  // Insert the e-class top button after the scroll Top button
  topButton.parentNode.insertBefore(eclassTopButton, topButton.nextSibling);

  console.log('[BetterE-class] E-class Top button added successfully');
})();
