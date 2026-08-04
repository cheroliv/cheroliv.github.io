document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    var form = document.getElementById('contact-form');
    if (!form) return;

    var CONTACT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyXWgSUaRc9g6bSSbjZPiMrgD35E65Jzynpq3sIgqRTzozbN_UFgaEwXGsnkq2P1-D33Q/exec';

    var pageRenderTime = Date.now();

    var submitButton = form.querySelector('button[type="submit"]');
    var successMessage = document.getElementById('contact-success-message');
    var errorMessage = document.getElementById('contact-error-message');

    var nameInput = form.querySelector('input[name="name"]');
    var emailInput = form.querySelector('input[name="email"]');
    var phoneInput = form.querySelector('input[name="phone"]');
    var subjectInput = form.querySelector('input[name="subject"]');
    var messageInput = form.querySelector('textarea[name="message"]');
    var honeypotInput = form.querySelector('input[name="hp_name"]');

    function collectPayload() {
        var payload = {
            name: nameInput.value.trim(),
            email: emailInput.value.trim(),
            phone: phoneInput ? phoneInput.value.trim() : '',
            subject: subjectInput.value.trim(),
            message: messageInput.value.trim(),
            user_agent: navigator.userAgent.substring(0, 500),
            hp_name: honeypotInput ? honeypotInput.value.trim() : '',
            ts_render: pageRenderTime
        };
        return payload;
    }

    function sendToEmailService(payload) {
        return fetch(CONTACT_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            redirect: 'follow',
            body: new URLSearchParams(payload)
        });
    }

    function saveToFirestore(fb, payload) {
        var messagesCollection = fb.collection(fb.db, 'contact_messages');
        return fb.addDoc(messagesCollection, {
            name: payload.name,
            email: payload.email,
            phone: payload.phone,
            subject: payload.subject,
            message: payload.message,
            created_at: fb.serverTimestamp(),
            user_agent: payload.user_agent
        });
    }

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

        var payload = collectPayload();

        var emailPromise = sendToEmailService(payload).catch(function (error) {
            console.error('Erreur email service:', error);
            return null;
        });

        var firestorePromise = waitForFirebase().then(function (fb) {
            return saveToFirestore(fb, payload);
        }).catch(function (error) {
            console.error('Erreur Firestore:', error);
            return null;
        });

        Promise.all([emailPromise, firestorePromise]).then(function (results) {
            var emailOk = results[0] !== null;
            var firestoreOk = results[1] !== null;
            if (emailOk || firestoreOk) {
                successMessage.style.display = 'block';
                form.reset();
                form.classList.remove('was-validated');
            } else {
                errorMessage.style.display = 'block';
            }
        }).finally(function () {
            submitButton.disabled = false;
            submitButton.innerHTML = '\n                <i class="bi bi-send me-2"></i>\n                Envoyer le Message\n            ';
        });
    }, false);
});
