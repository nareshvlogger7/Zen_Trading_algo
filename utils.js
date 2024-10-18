// utils.js

// Validate required fields in request body
function validateRequestBody(requiredFields, reqBody) {
    const missingFields = requiredFields.filter(field => !reqBody[field]);
    if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
}

// Format date to a specific string format (YYYY-MM-DD)
function formatDate(date) {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return new Date(date).toLocaleDateString('en-CA', options).replace(/\//g, '-');
}

// Log error messages to the console
function logError(message, error) {
    console.error(`[ERROR] ${message}:`, error);
}

// Generate a response object for API responses
function generateResponse(status, message, data = null) {
    return {
        status,
        message,
        data,
    };
}

module.exports = {
    validateRequestBody,
    formatDate,
    logError,
    generateResponse,
};
