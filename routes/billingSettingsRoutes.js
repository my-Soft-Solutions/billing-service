'use strict';

const express = require('express');
const BillingSettingsController = require('../controllers/BillingSettingsController');
const verifyToken = require('../middlewares/verifyToken');

const router = express.Router();

router.use(verifyToken);
router.get('/', BillingSettingsController.get);
router.post('/', BillingSettingsController.create);
router.put('/', BillingSettingsController.update);

module.exports = router;
