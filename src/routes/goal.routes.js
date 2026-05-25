import { Router } from "express";
import * as goalController from "../controllers/goal.controller.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/weekly", goalController.weekly);
router.put("/weekly", requireRole("admin"), goalController.updateWeekly);
router.post("/weekly/claim", goalController.claim);

export default router;
