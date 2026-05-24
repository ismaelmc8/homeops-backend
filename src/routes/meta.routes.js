import { Router } from "express";
import * as metaController from "../controllers/meta.controller.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/dashboard", metaController.dashboard);
router.put("/settings", requireRole("admin"), metaController.updateSettings);

export default router;
