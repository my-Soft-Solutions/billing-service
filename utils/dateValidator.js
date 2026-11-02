
const {validationError} = require('../utils/pagination')

function  validateDate(value, field) {
         if (value === null || value === undefined || value === '') return null;
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw validationError(`${field} must use YYYY-MM-DD format`);
        }
        const date = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
            throw validationError(`${field} must be a valid date`);
        }
        return value;
    }

module.exports = validateDate;