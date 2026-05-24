import { Router } from "express";
import * as visualizationController from "../controllers/visualization.controller.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/overview", visualizationController.overview);
router.get("/heatmap", visualizationController.heatmap);
router.get("/zones/:zoneId", visualizationController.zoneDetail);
router.put("/layout", requireRole("admin"), visualizationController.updateLayout);

export default router;
