 function handleError(error, res, resource = 'client') {
        console.error(error);
        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeDatabaseError') {
            return res.status(400).json({ message: error.message });
        }
        return res.status(500).json({ message: `Failed to process ${resource} request` });
    }

module.exports = handleError;