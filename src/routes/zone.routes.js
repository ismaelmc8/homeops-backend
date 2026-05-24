import { Router } from "express";
import * as zoneController from "../controllers/zone.controller.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/", zoneController.list);
router.post("/", requireRole("admin"), zoneController.create);
router.put("/:id", requireRole("admin"), zoneController.update);
router.delete("/:id", requireRole("admin"), zoneController.remove);

export default router;
