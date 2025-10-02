function showError(message, titleElement, infoElement) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;

    if (titleElement) {
        titleElement.textContent = 'Error';
    }

    if (infoElement) {
        infoElement.textContent = '';
    }

    const container = document.querySelector('.container');
    if (container && container.firstChild) {
        container.insertBefore(errorDiv, container.firstChild.nextSibling);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function handleFetchError(error, fallbackMessage = 'An error occurred') {
    console.error('Fetch error:', error);
    return fallbackMessage;
}

function extractUuidFromPath(pathSegment) {
    return window.location.pathname.split(`/${pathSegment}/`)[1];
}
