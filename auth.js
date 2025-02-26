const express = require("express");
const { body, validationResult } = require("express-validator");
const Razorpay = require("razorpay");
const User = require("../models/User");
const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Registration route
router.post(
  "/register",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("age").isInt({ min: 1 }).withMessage("Valid age is required"),
    body("gender").isIn(["male", "female", "other"]).withMessage("Valid gender is required"),
    body("category").notEmpty().withMessage("Category is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ msg: "Validation errors", errors: errors.array() });
    }

    try {
      const { name, email, phone, age, gender, category } = req.body;
      const amount = 49900; // Amount in paise (₹1)

      // Create Razorpay order
      const order = await razorpay.orders.create({
        amount,
        currency: "INR",
        receipt: `order_rcptid_${Date.now()}`,
      });

      console.log("🛒 Razorpay Order Created:", order);
      res.status(200).json(order);
    } catch (error) {
      console.error("❌ Error creating Razorpay order:", error);
      res.status(500).json({ msg: "Error creating order", error: error.message });
    }
  }
);

// Payment verification and user saving
router.post(
  "/verify-payment",
  [
    body("payment_id").notEmpty().withMessage("Payment ID is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("❌ Validation errors:", errors.array());
      return res.status(400).json({ msg: "Validation errors", errors: errors.array() });
    }

    try {
      const { name, email, phone, age, gender, category, payment_id } = req.body;

      console.log("📥 Incoming registration data:", req.body);

      // Verify payment
      const payment = await razorpay.payments.fetch(payment_id);
      console.log("🔍 Payment Verification Response:", payment);
      if (!payment || payment.status !== "captured") {
        return res.status(400).json({ msg: "Payment verification failed" });
      }

      // Generate unique chest number
      const lastUser = await User.findOne().sort({ chestNumber: -1 });
      const chestNumber = lastUser ? lastUser.chestNumber + 1 : 1000;

      // Save user after successful payment (allow duplicate emails)
      const newUser = new User({
        name,
        email,
        phone,
        age,
        gender,
        category,
        payment_id,
        chestNumber,
      });

      await newUser.save();

      console.log("✅ User Registered:", newUser);
      res.status(201).json({ msg: "Registration successful", user: newUser });
    } catch (error) {
      console.error("❌ Server Error during registration:", error);
      res.status(500).json({ msg: "Server error", error: error.message });
    }
  }
);

module.exports = router;
