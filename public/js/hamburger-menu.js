(function() {
  const hamburgerBtn = document.getElementById('hamburger-menu-btn');
  const hamburgerMenu = document.getElementById('hamburger-menu');
  const menuUserInfo = document.getElementById('menu-user-info');
  const menuUsername = document.getElementById('menu-username');
  const menuDashboard = document.getElementById('menu-dashboard');
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
  }

  // Close menu
  function closeMenu() {
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    hamburgerMenu.setAttribute('aria-hidden', 'true');
    hamburgerBtn.classList.remove('active');
    hamburgerMenu.classList.remove('active');
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

      // Check authorization status
      if (window.functions) {
        try {
          const { httpsCallable } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js');
          const checkAuth = httpsCallable(window.functions, 'isAuthorizedVolunteerV2');
          const result = await checkAuth();
          const isAuthorized = result.data.isAuthorized;

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
      menuNewBox.style.display = 'block';
      menuSignOut.style.display = 'block';
      menuSignIn.style.display = 'none';
    } else {
      // Not authenticated or anonymous - hide hamburger button
      hamburgerBtn.style.display = 'none';
      menuUserInfo.style.display = 'none';
      menuDashboard.style.display = 'none';
      menuNewBox.style.display = 'none';
      menuSignOut.style.display = 'none';
      menuSignIn.style.display = 'block';

      // Close menu if it's open
      closeMenu();
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
