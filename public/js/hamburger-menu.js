(function() {
  const hamburgerBtn = document.getElementById('hamburger-menu-btn');
  const hamburgerMenu = document.getElementById('hamburger-menu');
  const menuUserInfo = document.getElementById('menu-user-info');
  const menuUsername = document.getElementById('menu-username');
  const menuDashboard = document.getElementById('menu-dashboard');
  const menuAdmin = document.getElementById('menu-admin');
  const menuNewBox = document.getElementById('menu-new-box');
  const menuSignIn = document.getElementById('menu-sign-in');
  const menuSignOut = document.getElementById('menu-sign-out');

  // Toggle menu open/close
  function toggleMenu() {
    const isExpanded = hamburgerBtn.getAttribute('aria-expanded') === 'true';
    hamburgerBtn.setAttribute('aria-expanded', !isExpanded);
    hamburgerMenu.setAttribute('aria-hidden', isExpanded);
    hamburgerBtn.classList.toggle('active');
    hamburgerMenu.classList.toggle('active');

    // Update menu item tabindex based on menu state
    const menuItems = hamburgerMenu.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
      if (!isExpanded) {
        // Opening menu - make visible items focusable
        if (item.style.display !== 'none') {
          item.removeAttribute('tabindex');
          item.removeAttribute('aria-hidden');
        }
      } else {
        // Closing menu - make all items unfocusable
        item.setAttribute('tabindex', '-1');
        item.setAttribute('aria-hidden', 'true');
      }
    });
  }

  // Close menu
  function closeMenu() {
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    hamburgerMenu.setAttribute('aria-hidden', 'true');
    hamburgerBtn.classList.remove('active');
    hamburgerMenu.classList.remove('active');

    // Make all menu items unfocusable when closed
    const menuItems = hamburgerMenu.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
      item.setAttribute('tabindex', '-1');
      item.setAttribute('aria-hidden', 'true');
    });
  }

  // Generate random 5-digit box ID
  function generateBoxId() {
    return Math.floor(10000 + Math.random() * 90000).toString();
  }

  // Handle New Box click
  function handleNewBox(e) {
    e.preventDefault();
    const boxId = generateBoxId();
    window.location.href = `/setup?id=${boxId}`;
  }

  // Handle Sign Out click
  async function handleSignOut(e) {
    e.preventDefault();
    try {
      if (window.auth) {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
        await signOut(window.auth);
      }
      window.location.href = '/login';
    } catch (error) {
      console.error('Sign out error:', error);
      window.location.href = '/login';
    }
  }

  // Update menu based on auth state
  async function updateMenu(user) {
    if (user && !user.isAnonymous) {
      // Authenticated user
      let username = user.displayName || user.email || 'Unknown';

      // Strip @domain.com from email if present
      if (username.includes('@')) {
        username = username.split('@')[0];
      }

      // Check authorization status with session caching
      if (window.functions) {
        try {
          // Check session cache first
          const cacheKey = `t4t_auth_${user.uid}`;
          const cachedAuth = sessionStorage.getItem(cacheKey);

          let isAuthorized;
          if (cachedAuth !== null) {
            // Use cached result (no need to call function)
            isAuthorized = cachedAuth === 'true';
          } else {
            // No cache - call function and cache result
            const { httpsCallable } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js');
            const checkAuth = httpsCallable(window.functions, 'isAuthorizedVolunteerV2');
            const result = await checkAuth();
            isAuthorized = result.data.isAuthorized;

            // Cache for this session
            sessionStorage.setItem(cacheKey, isAuthorized ? 'true' : 'false');
          }

          // Remember authorization status in localStorage (persists across sessions)
          if (isAuthorized) {
            localStorage.setItem('t4t_wasAuthorized', 'true');
          }

          // Add asterisk if not authorized
          const suffix = isAuthorized ? '' : '*';
          menuUsername.textContent = `${username}${suffix}`;
        } catch (err) {
          menuUsername.textContent = username;
        }
      } else {
        menuUsername.textContent = username;
      }

      // Show hamburger button and authenticated menu items
      hamburgerBtn.style.display = 'flex';
      menuUserInfo.style.display = 'block';
      menuDashboard.style.display = 'block';
      menuAdmin.style.display = 'block';
      menuNewBox.style.display = 'block';
      menuSignOut.style.display = 'block';
      menuSignIn.style.display = 'none';

      // Keep tabindex and aria-hidden until menu is expanded
      // (They are removed by toggleMenu when menu opens)
    } else {
      // Not authenticated or anonymous
      // Check if user was previously authorized
      const wasAuthorized = localStorage.getItem('t4t_wasAuthorized') === 'true';

      if (wasAuthorized) {
        // Show hamburger for previously authorized users (not logged in)
        hamburgerBtn.style.display = 'flex';
        menuUserInfo.style.display = 'none';
        menuDashboard.style.display = 'none';
        menuDashboard.setAttribute('tabindex', '-1');
        menuDashboard.setAttribute('aria-hidden', 'true');
        menuAdmin.style.display = 'none';
        menuAdmin.setAttribute('tabindex', '-1');
        menuAdmin.setAttribute('aria-hidden', 'true');
        menuNewBox.style.display = 'none';
        menuNewBox.setAttribute('tabindex', '-1');
        menuNewBox.setAttribute('aria-hidden', 'true');
        menuSignOut.style.display = 'none';
        menuSignOut.setAttribute('tabindex', '-1');
        menuSignOut.setAttribute('aria-hidden', 'true');
        menuSignIn.style.display = 'block';
      } else {
        // Never authorized - hide hamburger button completely
        hamburgerBtn.style.display = 'none';
        menuUserInfo.style.display = 'none';
        menuDashboard.style.display = 'none';
        menuDashboard.setAttribute('tabindex', '-1');
        menuDashboard.setAttribute('aria-hidden', 'true');
        menuAdmin.style.display = 'none';
        menuAdmin.setAttribute('tabindex', '-1');
        menuAdmin.setAttribute('aria-hidden', 'true');
        menuNewBox.style.display = 'none';
        menuNewBox.setAttribute('tabindex', '-1');
        menuNewBox.setAttribute('aria-hidden', 'true');
        menuSignOut.style.display = 'none';
        menuSignOut.setAttribute('tabindex', '-1');
        menuSignOut.setAttribute('aria-hidden', 'true');
        menuSignIn.style.display = 'block';

        // Close menu if it's open
        closeMenu();
      }
    }
  }

  // Event listeners
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', toggleMenu);
  }

  if (menuNewBox) {
    menuNewBox.addEventListener('click', handleNewBox);
  }

  if (menuSignOut) {
    menuSignOut.addEventListener('click', handleSignOut);
  }

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!hamburgerMenu.contains(e.target) && !hamburgerBtn.contains(e.target)) {
      closeMenu();
    }
  });

  // Close menu when clicking on menu items (except New Box and Sign Out which handle themselves)
  const menuItems = hamburgerMenu.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    if (item.id !== 'menu-new-box' && item.id !== 'menu-sign-out') {
      item.addEventListener('click', closeMenu);
    }
  });

  // Wait for auth to be ready with retry logic
  let retryCount = 0;
  const maxRetries = 20;

  function initMenu() {
    if (window.auth) {
      window.auth.onAuthStateChanged((user) => {
        updateMenu(user);
      });
      // Update immediately if user is already signed in
      if (window.auth.currentUser) {
        updateMenu(window.auth.currentUser);
      }
    } else if (retryCount < maxRetries) {
      retryCount++;
      setTimeout(initMenu, 500);
    }
  }

  initMenu();
})();
