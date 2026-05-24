import { Router } from "express";
import * as metricsController from "../controllers/metrics.controller.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);
router.get("/me", metricsController.walletMe);

export default router;
