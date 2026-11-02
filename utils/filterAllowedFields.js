
function filterAllowedFields(data, allowedFields) {
    return Object.fromEntries(
        allowedFields
            .filter((field) => Object.hasOwn(data, field))
            .map((field) => [field, data[field]])
    );
}

module.exports = filterAllowedFields;
