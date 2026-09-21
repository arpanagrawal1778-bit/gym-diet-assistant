const router = require('express').Router();
const { getPreferences, updatePreferences, sendTestEmailController } = require('../controllers/reminderController');
const authMiddleware = require('../middleware/authMiddleware');
const validate = require('../middleware/validationMiddleware');
const { reminderPreferencesSchema } = require('../validators');

router.get('/', authMiddleware, getPreferences);
router.put('/', authMiddleware, validate(reminderPreferencesSchema), updatePreferences);
router.post('/test', authMiddleware, sendTestEmailController);

module.exports = router;