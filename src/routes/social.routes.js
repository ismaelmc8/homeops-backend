import { Router } from "express";
import * as socialController from "../controllers/social.controller.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/catalog", socialController.catalog);

router.use(authMiddleware);
router.get("/settings", socialController.getSettings);
router.put("/settings", requireRole("admin"), socialController.updateSettings);
router.get("/timeline", socialController.timeline);
router.post("/kudos", socialController.sendKudos);
router.get("/mvp", socialController.mvp);
router.get("/ranking", socialController.ranking);
router.get("/micro-goals", socialController.microGoals);

export default router;
