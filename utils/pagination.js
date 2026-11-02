function validationError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function parsePaginationValue(value, defaultValue, name, maximum) {
    if (value === undefined) {
        return defaultValue;
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
        throw validationError(`${name} must be a positive integer`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum && parsed > maximum)) {
        const range = maximum ? ` between 1 and ${maximum}` : ' as a positive integer';
        throw validationError(`${name} must be an integer${range}`);
    }
    return parsed;
}

function getStringFilter(filters, name) {
    const value = filters[name];
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'string') {
        throw validationError(`${name} must be a string`);
    }
    return value;
}

module.exports = {
    parsePaginationValue,
    validationError,
    getStringFilter
};