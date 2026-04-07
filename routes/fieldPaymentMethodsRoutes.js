/**
 * Field Payment Methods Routes
 * Rutas para gestionar los metodos de pago de las canchas
 */

const express = require('express');

const verificarToken = require('../middleware/authMiddleware');
const { uploadPaymentQR } = require('../middleware/uploadMiddleware');
const {
  getFieldPaymentMethods,
  getAdminFieldsPaymentMethods,
  upsertFieldPaymentMethod,
  updateFieldPaymentMethods,
  deleteFieldPaymentMethod,
  uploadQRImage,
} = require('../controllers/fieldPaymentMethodsController');

const router = express.Router();

// Rutas publicas (para clientes)
router.get('/field/:fieldId', getFieldPaymentMethods);

// Rutas protegidas (para admins)
router.get('/admin/fields', verificarToken, getAdminFieldsPaymentMethods);
router.post('/field/:fieldId', verificarToken, upsertFieldPaymentMethod);
router.put('/field/:fieldId', verificarToken, updateFieldPaymentMethods);
router.delete('/field/:fieldId/:methodType', verificarToken, deleteFieldPaymentMethod);
router.post(
  '/field/:fieldId/:methodType/qr',
  verificarToken,
  uploadPaymentQR.single('qrImage'),
  uploadQRImage
);

module.exports = router;
