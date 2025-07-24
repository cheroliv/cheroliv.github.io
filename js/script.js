document.addEventListener('DOMContentLoaded', function() {

    const navbar = document.querySelector('.navbar.fixed-top');
    const heroSection = document.querySelector('.hero-section');
    const scrollSpyTarget = document.body;

    // --- Ajustement dynamique de la mise en page en fonction de la hauteur de la barre de navigation ---
    function adjustLayout() {
        if (!navbar) return;

        const navbarHeight = navbar.offsetHeight;
        
        // 1. Met à jour une variable CSS avec la hauteur de la barre de navigation
        document.documentElement.style.setProperty('--navbar-height', navbarHeight + 'px');

        // 2. Met à jour le décalage du ScrollSpy de Bootstrap
        //    Ceci garantit que le bon lien est mis en surbrillance au bon moment
        const scrollSpyInstance = bootstrap.ScrollSpy.getInstance(scrollSpyTarget);
        if (scrollSpyInstance) {
            scrollSpyInstance._config.offset = navbarHeight;
            scrollSpyInstance.refresh();
        }
    }

    // --- Logique du sélecteur de th��me ---
    const themeOptions = document.querySelectorAll('.theme-option');
    const currentThemeSpan = document.getElementById('current-theme');
    const htmlElement = document.documentElement;

    // Fonction pour appliquer un thème
    function setTheme(theme) {
        htmlElement.setAttribute('data-bs-theme', theme);
        if (currentThemeSpan) {
            // Met à jour le texte du bouton (ex: 'high-contrast' -> 'High Contrast')
            const themeName = theme.charAt(0).toUpperCase() + theme.slice(1).replace('-', ' ');
            currentThemeSpan.textContent = themeName;
        }
        localStorage.setItem('theme', theme); // Sauvegarde le choix
    }

    // Applique le thème au clic sur une option
    themeOptions.forEach(option => {
        option.addEventListener('click', function(event) {
            event.preventDefault();
            const selectedTheme = this.getAttribute('data-theme');
            setTheme(selectedTheme);
        });
    });

    // Au chargement, vérifie s'il y a un thème sauvegardé
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme);
    } else {
        // S'assure que l'affichage par défaut est correct
        const defaultTheme = htmlElement.getAttribute('data-bs-theme') || 'light';
        setTheme(defaultTheme);
    }

    // --- Exécution initiale et écouteurs d'événements ---
    
    // Ajuste la mise en page une fois que toutes les ressources (polices, images) sont chargées
    window.addEventListener('load', adjustLayout);
    
    // Réajuste la mise en page lors du redimensionnement de la fenêtre
    window.addEventListener('resize', adjustLayout);

    // Réajuste la mise en page lorsque le contenu de la barre de navigation change (ex: ouverture/fermeture du menu)
    const navbarCollapse = document.getElementById('navbarNav');
    if (navbarCollapse) {
        navbarCollapse.addEventListener('shown.bs.collapse', adjustLayout);
        navbarCollapse.addEventListener('hidden.bs.collapse', adjustLayout);
    }
});
