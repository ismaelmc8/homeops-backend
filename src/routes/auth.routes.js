import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.get("/registration-available", authController.registrationAvailable);
router.post("/register", authController.register);
router.get("/activation-token", authController.validateToken);
router.post("/set-password", authController.setPassword);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/me", authMiddleware, authController.me);

export default router;
