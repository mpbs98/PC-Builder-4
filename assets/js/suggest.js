document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('suggestForm');
    if (!form) return;

    const successMessage = document.getElementById('successMessage');
    const formMessage = document.getElementById('formMessage');
    const newSuggestionButton = document.getElementById('newSuggestion');

    const fields = {
        category: document.getElementById('componentCategory'),
        name: document.getElementById('componentName'),
        brand: document.getElementById('componentBrand'),
        price: document.getElementById('componentPrice'),
        releaseDate: document.getElementById('releaseDate'),
        specs: document.getElementById('componentSpecs'),
        email: document.getElementById('userEmail')
    };

    const validators = {
        category: {
            test: value => Boolean(value),
            message: 'Please select a component category.'
        },
        name: {
            test: value => /^[A-Za-z0-9\s\-\.()+/]{3,80}$/.test(value),
            message: 'Component name must be 3-80 characters and use only letters, numbers, spaces, +, /, dots, hyphens, or parentheses.'
        },
        brand: {
            test: value => value === '' || /^[A-Za-z0-9\s\-\.&]{2,40}$/.test(value),
            message: 'Brand must be 2-40 characters and use only letters, numbers, spaces, dots, hyphens, or &.'
        },
        price: {
            test: value => value === '' || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) >= 0.01 && Number(value) <= 9999.99),
            message: 'Price must be between 0.01 and 9999.99, with up to 2 decimal places.'
        },
        releaseDate: {
            test: value => value === '' || isValidReleaseDate(value),
            message: 'Release date cannot be in the future.'
        },
        specs: {
            test: value => value === '' || /^[A-Za-z0-9\s,.;:+\-_/()x"']{10,500}$/.test(value),
            message: 'Specifications must be 10-500 characters and use common specification symbols only.'
        },
        email: {
            test: value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value),
            message: 'Please enter a valid email address.'
        }
    };

    Object.entries(fields).forEach(([key, field]) => {
        field.addEventListener('input', function () {
            validateField(key);
            hideFormMessage();
            successMessage.classList.add('d-none');
        });

        field.addEventListener('change', function () {
            validateField(key);
            hideFormMessage();
            successMessage.classList.add('d-none');
        });
    });

    form.addEventListener('submit', function (event) {
        event.preventDefault();

        const result = validateForm();
        if (!result.isValid) {
            showFormMessage(result.errors);
            successMessage.classList.add('d-none');
            return;
        }

        hideFormMessage();
        form.classList.add('d-none');
        successMessage.classList.remove('d-none');
    });

    form.addEventListener('reset', function () {
        setTimeout(function () {
            clearValidation();
            hideFormMessage();
            successMessage.classList.add('d-none');
        }, 0);
    });

    if (newSuggestionButton) {
        newSuggestionButton.addEventListener('click', function () {
            form.reset();
            clearValidation();
            hideFormMessage();
            successMessage.classList.add('d-none');
            form.classList.remove('d-none');
            fields.category.focus();
        });
    }

    function validateForm() {
        const errors = [];

        Object.keys(fields).forEach(key => {
            const error = validateField(key);
            if (error) {
                errors.push(error);
            }
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    function validateField(key) {
        const field = fields[key];
        const validator = validators[key];
        const value = field.value.trim();
        const isValid = validator.test(value);

        field.classList.toggle('is-invalid', !isValid);
        field.classList.toggle('is-valid', isValid && value !== '');

        return isValid ? '' : validator.message;
    }

    function showFormMessage(errors) {
        formMessage.className = 'alert alert-danger';
        formMessage.innerHTML = `
            <h5 class="alert-heading mb-2"><i class="bi bi-exclamation-triangle"></i> Please fix the form</h5>
            <ul class="mb-0">
                ${errors.map(error => `<li>${escapeHTML(error)}</li>`).join('')}
            </ul>
        `;
    }

    function hideFormMessage() {
        formMessage.className = 'alert d-none';
        formMessage.innerHTML = '';
    }

    function clearValidation() {
        Object.values(fields).forEach(field => {
            field.classList.remove('is-valid', 'is-invalid');
        });
    }

    function isValidReleaseDate(value) {
        const selectedDate = new Date(`${value}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return !Number.isNaN(selectedDate.getTime()) && selectedDate <= today;
    }

    function escapeHTML(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
