document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    var form = document.getElementById('contact-form');
    if (!form) return;

    var submitButton = form.querySelector('button[type="submit"]');
    var successMessage = document.getElementById('contact-success-message');
    var errorMessage = document.getElementById('contact-error-message');

    var nameInput = form.querySelector('input[name="name"]');
    var emailInput = form.querySelector('input[name="email"]');
    var phoneInput = form.querySelector('input[name="phone"]');
    var subjectInput = form.querySelector('input[name="subject"]');
    var messageInput = form.querySelector('textarea[name="message"]');
    var honeypotInput = form.querySelector('input[name="hp_name"]');

    function waitForFirebase(timeoutMs) {
        timeoutMs = timeoutMs || 5000;
        return new Promise(function (resolve, reject) {
            if (window.__FIREBASE__) {
                resolve(window.__FIREBASE__);
                return;
            }
            var start = Date.now();
            var interval = setInterval(function () {
                if (window.__FIREBASE__) {
                    clearInterval(interval);
                    resolve(window.__FIREBASE__);
                } else if (Date.now() - start > timeoutMs) {
                    clearInterval(interval);
                    reject(new Error('Firebase SDK non disponible — timeout ' + timeoutMs + 'ms'));
                }
            }, 100);
        });
    }

    function validateForm() {
        nameInput.setCustomValidity('');
        emailInput.setCustomValidity('');
        if (phoneInput) phoneInput.setCustomValidity('');
        subjectInput.setCustomValidity('');
        messageInput.setCustomValidity('');

        if (nameInput.value.trim().length < 1) {
            nameInput.setCustomValidity('Veuillez saisir votre nom.');
        }

        var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(emailInput.value.trim())) {
            emailInput.setCustomValidity('Veuillez saisir une adresse email valide.');
        }

        if (phoneInput && phoneInput.value.trim() !== '') {
            var phonePattern = /^\d{10,15}$/;
            if (!phonePattern.test(phoneInput.value.trim())) {
                phoneInput.setCustomValidity('Veuillez saisir un numéro valide (10 à 15 chiffres).');
            }
        }

        if (subjectInput.value.trim().length < 3) {
            subjectInput.setCustomValidity('Veuillez saisir un sujet (3 caractères minimum).');
        }

        if (messageInput.value.trim().length < 10) {
            messageInput.setCustomValidity('Veuillez saisir un message (10 caractères minimum).');
        }

        form.classList.add('was-validated');
        return form.checkValidity();
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        event.stopPropagation();

        if (!validateForm()) return;

        if (honeypotInput && honeypotInput.value.trim() !== '') {
            successMessage.style.display = 'block';
            form.reset();
            form.classList.remove('was-validated');
            return;
        }

        submitButton.disabled = true;
        submitButton.innerHTML = '\n            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>\n            Envoi en cours...\n        ';

        successMessage.style.display = 'none';
        errorMessage.style.display = 'none';

        waitForFirebase().then(function (fb) {
            var messagesCollection = fb.collection(fb.db, 'contact_messages');

            return fb.addDoc(messagesCollection, {
                name: nameInput.value.trim(),
                email: emailInput.value.trim(),
                phone: phoneInput ? phoneInput.value.trim() : '',
                subject: subjectInput.value.trim(),
                message: messageInput.value.trim(),
                created_at: fb.serverTimestamp(),
                user_agent: navigator.userAgent.substring(0, 500)
            });
        }).then(function () {
            successMessage.style.display = 'block';
            form.reset();
            form.classList.remove('was-validated');
        }).catch(function (error) {
            console.error('Erreur Firestore:', error);
            errorMessage.style.display = 'block';
        }).then(function () {
            submitButton.disabled = false;
            submitButton.innerHTML = '\n                <i class="bi bi-send me-2"></i>\n                Envoyer le Message\n            ';
        });
    }, false);
});
