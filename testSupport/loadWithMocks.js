'use strict';

const Module = require('node:module');

function loadWithMocks(modulePath, mocks) {
    const resolvedPath = require.resolve(modulePath);
    const originalLoad = Module._load;

    Module._load = function loadMockedDependency(request, parent, isMain) {
        if (
            parent &&
            parent.filename === resolvedPath &&
            Object.prototype.hasOwnProperty.call(mocks, request)
        ) {
            return mocks[request];
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    try {
        delete require.cache[resolvedPath];
        return require(resolvedPath);
    } finally {
        Module._load = originalLoad;
    }
}

module.exports = loadWithMocks;
