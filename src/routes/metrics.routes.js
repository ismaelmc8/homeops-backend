import { Router } from "express";
import * as metricsController from "../controllers/metrics.controller.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/summary", metricsController.metricsSummary);
router.get("/admin", requireRole("admin"), metricsController.metricsAdmin);
router.get("/balance", requireRole("admin"), metricsController.metricsBalance);

export default router;
