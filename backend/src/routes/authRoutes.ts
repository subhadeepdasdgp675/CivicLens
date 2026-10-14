import { Router } from "express";
import { register, login, getMe, forgotPassword, verifyOtp, resetPassword, sendLoginOtp, verifyLoginOtp, sendSignupOtp, quickAdminLogin } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Public routes
router.post("/admin-quick-login", quickAdminLogin);
router.post("/send-signup-otp", sendSignupOtp);
router.post("/register", register);
router.post("/login", login);
router.post("/send-login-otp", sendLoginOtp);
router.post("/verify-login-otp", verifyLoginOtp);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);

// Protected routes
router.get("/me", authenticate, getMe);

export default router;
