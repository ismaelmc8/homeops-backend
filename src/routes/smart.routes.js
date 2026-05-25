import { Router } from "express";
import * as smartController from "../controllers/smart.controller.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/settings", requireRole("admin"), smartController.getSettings);
router.put("/settings", requireRole("admin"), smartController.updateSettings);
router.put("/prefs", smartController.updatePrefs);
router.post("/notifications/:id/read", smartController.markNotificationRead);

export default router;
