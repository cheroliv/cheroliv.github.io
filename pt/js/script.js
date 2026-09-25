// ===============================================================================================================
// E3PO - Enhanced Experience Engine for Personal Websites
// ===============================================================================================================
// This script manages theme switching, smooth scrolling, dynamic navbar adjustments, and other UX enhancements.
// Each class is designed to be self-contained and initialized safely to prevent site-wide script failures.
// ===============================================================================================================

/**
 * Theme values shared by the pure helpers and the ThemeManager below.
 * Kept as plain constants so Node.js can assert them without a DOM.
 */
var THEME_LIGHT = 'light';
var THEME_DARK = 'dark';
var THEME_HIGH_CONTRAST = 'high-contrast';

var HIGHLIGHT_LIGHT =
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css';
var HIGHLIGHT_DARK =
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css';

/**
 * Relative hero illustration per theme.
 *
 * Relative on purpose: variant pages live one level deep (`/en/index.html`),
 * so a root-absolute `/img/...` would resolve to the site root and 404.
 */
var HERO_SVG = {
    light: 'img/undraw_road_to_knowledge_light.svg',
    dark: 'img/undraw_road_to_knowledge_dark.svg',
    'high-contrast': 'img/undraw_road_to_knowledge_high_contrast.svg',
};

/** The three themes the switcher offers; anything else is not a theme. */
function isKnownTheme(theme) {
    return theme === THEME_LIGHT || theme === THEME_DARK || theme === THEME_HIGH_CONTRAST;
}

/**
 * Reads the localized label of a theme option from its own markup.
 *
 * US-16b — the label must never be a hardcoded English string: the menu is
 * translated per language, and `updateThemeUI` rewrote it with `Light`/`Dark`/
 * `High Contrast` at runtime, reverting the localized text (WCAG 3.1.1). The
 * label is the option's text content minus its icon, falling back to the
 * option's `textContent` when no icon is present.
 */
function themeLabelFromOption(option) {
    if (!option) return '';
    const clone = option.cloneNode(true);
    clone.querySelectorAll('i, svg').forEach((icon) => icon.remove());
    return (clone.textContent || '').trim();
}

/**
 * Reads one key from a `Storage` defensively.
 *
 * `localStorage` access throws in private browsing (Safari) and under Firefox
 * enhanced tracking protection — an unguarded read aborts the whole
 * `ThemeManager` constructor, leaving the switcher with no listener at all.
 * A storage failure must degrade to "no preference", never kill the theme.
 */
function safeGetItem(storage, key) {
    try {
        return storage ? storage.getItem(key) : null;
    } catch (e) {
        return null;
    }
}

/** Writes one key to a `Storage`, silently ignoring a blocked storage. */
function safeSetItem(storage, key, value) {
    try {
        if (storage) storage.setItem(key, value);
    } catch (e) {
        // Storage unavailable (private mode / RFP): the preference simply
        // lives for the current page only.
    }
}

/**
 * Resolves the theme to apply on load.
 *
 * A stored, known theme wins; otherwise the system preference decides. A
 * storage that throws is treated as empty. Pure: callers pass the storage and
 * the system preference, so the rule is testable without a browser.
 */
function resolveInitialTheme(storage, systemPrefersDark) {
    var saved = safeGetItem(storage, 'preferred-theme');
    if (isKnownTheme(saved)) return saved;
    return systemPrefersDark ? THEME_DARK : THEME_LIGHT;
}

/** The highlight.js stylesheet href for a theme (light for the default). */
function highlightStyleHref(theme) {
    return theme === THEME_DARK || theme === THEME_HIGH_CONTRAST ? HIGHLIGHT_DARK : HIGHLIGHT_LIGHT;
}

/** The hero illustration path for a theme (light for the default). */
function heroSvgPath(theme) {
    return HERO_SVG[theme] || HERO_SVG[THEME_LIGHT];
}

/**
 * Manages the website's theme (light, dark, high-contrast).
 * - Loads theme from localStorage or system preference.
 * - Updates UI elements to reflect the current theme.
 * - Handles user interaction for theme switching.
 */
class ThemeManager {
    constructor() {
        // Reference (French) theme labels. The switch is re-labelled from the
        // DOM for each language (WCAG 3.1.1).
        this.themes = {
            light: { name: 'Clair', icon: 'bi-sun', label: 'Clair' },
            dark: { name: 'Sombre', icon: 'bi-moon', label: 'Sombre' },
            'high-contrast': { name: 'Contraste élevé', icon: 'bi-circle-half', label: 'Contraste élevé' }
        };
        this.currentTheme = 'light';
        try {
            this.storage = window.localStorage;
        } catch (e) {
            this.storage = null;
        }
        this.init();
    }

    init() {
        this.loadTheme();
        this.setupEventListeners();
        this.updateThemeUI();
        this.listenForSystemThemeChanges();
    }

    loadTheme() {
        var systemPrefersDark = false;
        try {
            systemPrefersDark = !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
        } catch (e) {
            systemPrefersDark = false;
        }
        this.currentTheme = resolveInitialTheme(this.storage, systemPrefersDark);
        this.applyTheme(this.currentTheme);
    }

    setupEventListeners() {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTheme(e.currentTarget.dataset.theme);
            });
        });
    }

    switchTheme(theme) {
        if (!this.themes[theme]) return;
        this.currentTheme = theme;
        this.applyTheme(theme);
        safeSetItem(this.storage, 'preferred-theme', theme);
        this.updateThemeUI();

        // Re-focus the dropdown button to prevent page jump
        const themeButton = document.getElementById('themeDropdown');
        if (themeButton) {
            themeButton.focus();
        }
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        this.updateCodeTheme(theme);
        this.updateHeroSvg(theme);
    }

    updateHeroSvg(theme) {
        const heroSvg = document.querySelector('.hero-section .hero-svg-icon');
        if (!heroSvg) return;

        heroSvg.src = heroSvgPath(theme);
    }

    updateCodeTheme(theme) {
        const highlightThemeLink = document.getElementById('highlight-js-theme');
        if (!highlightThemeLink) return;

        // The href changes per theme, so the integrity attribute pinned to the
        // *default* stylesheet must be dropped — otherwise the browser blocks
        // the new stylesheet (SRI mismatch) and code highlighting silently
        // keeps the wrong palette.
        highlightThemeLink.removeAttribute('integrity');
        highlightThemeLink.setAttribute('href', highlightStyleHref(theme));
    }

    updateThemeUI() {
        const currentThemeData = this.themes[this.currentTheme];
        const themeButton = document.getElementById('themeDropdown');
        if (themeButton && currentThemeData) {
            // US-16b — the localized label lives in the option markup, not in a
            // hardcoded English string: read it from the DOM so the menu stays
            // translated in every language (WCAG 3.1.1).
            const currentOption = document.querySelector(
                `.theme-option[data-theme="${this.currentTheme}"]`,
            );
            const localizedLabel =
                themeLabelFromOption(currentOption) || currentThemeData.label;
            themeButton.setAttribute('aria-label', `Thème actuel : ${localizedLabel}`);
            const iconElement = themeButton.querySelector('i');
            if (iconElement) {
                iconElement.className = `bi ${currentThemeData.icon} me-1`;
            }
            // The text content of #current-theme is visually hidden but still
            // updated for screen readers.
            const currentThemeSpan = themeButton.querySelector('#current-theme');
            if (currentThemeSpan) {
                currentThemeSpan.textContent = localizedLabel;
            }
        }
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.toggle('active', option.dataset.theme === this.currentTheme);
        });
    }

    listenForSystemThemeChanges() {
        if (!window.matchMedia) return;
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!safeGetItem(this.storage, 'preferred-theme')) {
                this.switchTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
}

/**
 * Manages the "Scroll to Top" button.
 * - Shows the button when the user scrolls down.
 * - Adjusts its position to avoid overlapping with the footer.
 */
class ScrollToTopButton {
    constructor(button) {
        this.button = button;
        this.footer = document.querySelector('footer');
        this.init();
    }

    init() {
        window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
        this.button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    handleScroll() {
        const scrollY = window.scrollY;
        this.button.classList.toggle('show', scrollY > 300);

        if (this.footer) {
            const footerRect = this.footer.getBoundingClientRect();
            if (footerRect.top < window.innerHeight) {
                this.button.style.bottom = `${window.innerHeight - footerRect.top + 20}px`;
            } else {
                this.button.style.bottom = '20px';
            }
        }
    }
}

/**
 * Handles automatic closing of the mobile navigation menu using event delegation.
 * - When a navigation link or a dropdown item is clicked, the expanded mobile menu collapses.
 * - It specifically ignores clicks on dropdown toggles to allow submenus to open.
 */
class MobileMenuManager {
    constructor(navbar) {
        this.navbarCollapse = navbar.querySelector('.navbar-collapse');
        this.init();
    }

    init() {
        if (!this.navbarCollapse) return;
        const bsCollapse = new bootstrap.Collapse(this.navbarCollapse, { toggle: false });

        this.navbarCollapse.addEventListener('click', (event) => {
            const target = event.target;
            // Check if the clicked element is a nav-link (but not a dropdown toggle) OR a dropdown-item
            const isSimpleNavLink = target.matches('.nav-link') && !target.matches('[data-bs-toggle="dropdown"]');
            const isDropdownItem = target.matches('.dropdown-item');

            if (isSimpleNavLink || isDropdownItem) {
                if (this.navbarCollapse.classList.contains('show')) {
                    bsCollapse.hide();
                }
            }
        });
    }
}

/**
 * Handles smooth scrolling to anchor links with an offset for fixed headers.
 * - Intercepts clicks on internal anchor links.
 * - Calculates scroll position considering the fixed navbar height.
 * - Performs a smooth scroll to the target.
 */
class SmoothScrollWithOffset {
    constructor(navbarSelector = '.navbar') {
        this.navbar = document.querySelector(navbarSelector);
        this.init();
    }

    init() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', this.handleAnchorClick.bind(this));
        });
    }

    handleAnchorClick(event) {
        const anchor = event.currentTarget;
        const href = anchor.getAttribute('href');

        // Ignore dropdown toggles to prevent smooth scroll interference
        if (anchor.matches('[data-bs-toggle="dropdown"]')) {
            return;
        }

        if (href === '#' || href === '#home') { // Handle #home or empty hash specifically
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const targetId = href.substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
            event.preventDefault();
            const navbarCollapse = this.navbar.querySelector('.navbar-collapse');
            const isMobileMenuOpen = navbarCollapse && navbarCollapse.classList.contains('show');

            if (isMobileMenuOpen) {
                // Wait for the collapse animation to finish before scrolling
                navbarCollapse.addEventListener('hidden.bs.collapse', () => {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }, { once: true });
            } else {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }
}

/**
 * Dynamically updates the --navbar-height CSS variable based on the actual navbar height.
 * This ensures scroll-margin-top is always accurate for fixed headers.
 */
class NavbarHeightUpdater {
    constructor(navbar) {
        this.navbar = navbar;
        this.init();
    }

    init() {
        if (!this.navbar || !('ResizeObserver' in window)) return;
        const resizeObserver = new ResizeObserver(() => this.updateHeight());
        resizeObserver.observe(this.navbar);
        this.updateHeight(); // Initial update
    }

    updateHeight() {
        const brandElement = this.navbar.querySelector('.navbar-brand');
        let actualNavbarHeight = 0;

        if (brandElement) {
            actualNavbarHeight = brandElement.offsetHeight;
        }

        const newHeight = `${actualNavbarHeight}px`;
        document.documentElement.style.setProperty('--navbar-height', newHeight);
        console.log('NavbarHeightUpdater - New --navbar-height set to:', newHeight, 'from element:', brandElement);
    }
}

/**
 * Dynamically switches the navbar to burger mode when menu items no longer fit.
 * This is achieved by adding/removing the .navbar-expand-lg class, letting Bootstrap handle the UI changes.
 */
class DynamicNavbarBreakpoint {
    constructor(navbar) {
        this.navbar = navbar;
        this.container = navbar.querySelector('.container');
        this.brand = navbar.querySelector('.navbar-brand');
        this.navbarNav = navbar.querySelector('.navbar-nav');
        this.themeSelector = navbar.querySelector('#themeDropdown');
        this.init();
    }

    init() {
        if (!this.container || !this.brand || !this.navbarNav || !this.themeSelector) {
            console.warn('DynamicNavbarBreakpoint: Missing required elements for measurement.');
            return;
        }

        const resizeObserver = new ResizeObserver(() => this.checkBreakpoint());
        resizeObserver.observe(this.container);

        // Also observe the navbar itself in case its contents change dynamically
        resizeObserver.observe(this.navbarNav);

        // Initial check after a short delay to ensure rendering is complete
        setTimeout(() => this.checkBreakpoint(), 150);
    }

    checkBreakpoint() {
        // Temporarily force the navbar to be expanded to measure its true width
        this.navbar.classList.add('navbar-expand-lg');

        const brandWidth = this.brand.offsetWidth;
        const navbarNavWidth = this.navbarNav.offsetWidth;
        const themeSelectorWidth = this.themeSelector.offsetWidth;

        // Calculate the gap between flex items. We assume the gap is consistent.
        const navbarCollapse = this.navbar.querySelector('.navbar-collapse');
        const gapStyle = navbarCollapse ? getComputedStyle(navbarCollapse).gap : '0px';
        const gapWidth = parseFloat(gapStyle) || 8; // Default to 8px if gap is not found

        // Total required width is the sum of elements plus the gaps between them
        const requiredWidth = brandWidth + navbarNavWidth + themeSelectorWidth + (2 * gapWidth);

        // Available width is the container's inner width
        const availableWidth = this.container.clientWidth;

        // A small buffer to prevent elements from touching the edge
        const buffer = 5;

        if (requiredWidth + buffer > availableWidth) {
            // Not enough space, remove the class to collapse into burger mode
            this.navbar.classList.remove('navbar-expand-lg');
        } else {
            // Enough space, the class is already added, so Bootstrap handles expansion
            // This ensures the class remains for the expanded view
            this.navbar.classList.add('navbar-expand-lg');
        }

        // Re-initialize the dropdown
        if (this.themeSelector) {
            new bootstrap.Dropdown(this.themeSelector);
        }
    }
}

/**
 * Adds a "Copy" button to all code blocks for easy copying.
 * - Finds all <pre><code> blocks.
 * - Injects a button into each.
 * - Handles the click event to copy the code content to the clipboard.
 * - Provides user feedback on successful copy.
 */
class CodeBlockManager {
    constructor() {
        this.init();
    }

    init() {
        document.querySelectorAll('pre code').forEach(codeBlock => {
            const preElement = codeBlock.parentElement;
            if (preElement) {
                const copyButton = this.createCopyButton();
                preElement.appendChild(copyButton);
                this.setupCopyEventListener(copyButton, codeBlock);
            }
        });
    }

    createCopyButton() {
        const button = document.createElement('button');
        button.className = 'copy-code-btn';
        button.innerHTML = '<i class="bi bi-clipboard"></i> Copier';
        button.setAttribute('aria-label', 'Copier le code');
        return button;
    }

    setupCopyEventListener(button, codeBlock) {
        button.addEventListener('click', () => {
            const codeToCopy = codeBlock.innerText;
            navigator.clipboard.writeText(codeToCopy).then(() => {
                button.innerHTML = '<i class="bi bi-check-lg"></i> Copié !';
                button.classList.add('copied');
                setTimeout(() => {
                    button.innerHTML = '<i class="bi bi-clipboard"></i> Copier';
                    button.classList.remove('copied');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy code: ', err);
                button.innerText = 'Erreur';
            });
        });
    }
}


/**
 * Initializes all Bootstrap tooltips on the page.
 * - Finds all elements with `data-bs-toggle="tooltip"`.
 * - Creates a new Bootstrap Tooltip instance for each.
 */
class TooltipManager {
    constructor() {
        this.init();
    }

    init() {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
}

/**
 * Manages the international telephone input field.
 * - Initializes the intl-tel-input library on a given input field.
 */
class PhoneInputManager {
    constructor(inputElement) {
        this.inputElement = inputElement;
        this.init();
    }

    init() {
        if (typeof intlTelInput === 'undefined') {
            console.error('intl-tel-input library is not loaded.');
            return;
        }
        try {
            window.intlTelInput(this.inputElement, {
                initialCountry: "fr",
                utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@25.10.1/build/js/utils.js",
            });
            console.log('PhoneInputManager initialized successfully.');
        } catch (error) {
            console.error('Failed to initialize intl-tel-input:', error);
        }
    }
}


// ======================
// Main Initialization
// ======================
// Guarded so the pure helpers can be required by Node.js (no DOM there).
if (typeof document !== 'undefined' && document.addEventListener) {
document.addEventListener('DOMContentLoaded', () => {
    // Safely initialize ThemeManager
    if (document.getElementById('themeDropdown')) {
        try {
            new ThemeManager();
        } catch (e) {
            console.error("Failed to initialize ThemeManager:", e);
        }
    }

    // Safely initialize Navbar features
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        try {
            new MobileMenuManager(navbar);
        } catch (e) {
            console.error("Failed to initialize MobileMenuManager:", e);
        }
        try {
            new NavbarHeightUpdater(navbar); // Initialize NavbarHeightUpdater
        } catch (e) {
            console.error("Failed to initialize NavbarHeightUpdater:", e);
        }
        try {
            new DynamicNavbarBreakpoint(navbar); // Initialize the dynamic breakpoint logic
        } catch (e) {
            console.error("Failed to initialize DynamicNavbarBreakpoint:", e);
        }
    }

    // Safely initialize ScrollToTopButton
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    if (scrollToTopBtn) {
        try {
            new ScrollToTopButton(scrollToTopBtn);
        } catch (e) {
            console.error("Failed to initialize ScrollToTopButton:", e);
        }
    }

    // Safely initialize SmoothScrollWithOffset
    try {
        new SmoothScrollWithOffset();
    } catch (e) {
        console.error("Failed to initialize SmoothScrollWithOffset:", e);
    }

    // Safely initialize CodeBlockManager
    try {
        new CodeBlockManager();
    } catch (e) {
        console.error("Failed to initialize CodeBlockManager:", e);
    }

    // Safely initialize TooltipManager
    try {
        new TooltipManager();
    } catch (e) {
        console.error("Failed to initialize TooltipManager:", e);
    }

    // Safely initialize PhoneInputManager
    const phoneInputField = document.querySelector("#phone");
    if (phoneInputField) {
        try {
            new PhoneInputManager(phoneInputField);
        } catch (e) {
            console.error("Failed to initialize PhoneInputManager:", e);
        }
    }
});
}

// Export the pure helpers for Node.js testing (the browser never sets `module`).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        THEME_LIGHT: THEME_LIGHT,
        THEME_DARK: THEME_DARK,
        THEME_HIGH_CONTRAST: THEME_HIGH_CONTRAST,
        HIGHLIGHT_LIGHT: HIGHLIGHT_LIGHT,
        HIGHLIGHT_DARK: HIGHLIGHT_DARK,
        isKnownTheme: isKnownTheme,
        safeGetItem: safeGetItem,
        resolveInitialTheme: resolveInitialTheme,
        highlightStyleHref: highlightStyleHref,
        heroSvgPath: heroSvgPath,
    };
}