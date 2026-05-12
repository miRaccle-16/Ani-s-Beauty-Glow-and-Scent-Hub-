const express = require('express');
const router = express.Router();

// Paystack initialization (placeholder - add your keys later)
router.post('/paystack/initialize', (req, res) => {
    const { email, amount, productName } = req.body;
    
    // This is a placeholder. Replace with actual Paystack API call
    res.json({
        success: true,
        message: 'Paystack integration ready. Add your API keys in .env',
        authorization_url: 'https://checkout.paystack.com/placeholder'
    });
});

// Flutterwave initialization (placeholder)
router.post('/flutterwave/initialize', (req, res) => {
    const { email, amount, productName } = req.body;
    
    res.json({
        success: true,
        message: 'Flutterwave integration ready. Add your API keys in .env',
        payment_link: 'https://checkout.flutterwave.com/placeholder'
    });
});

module.exports = router;