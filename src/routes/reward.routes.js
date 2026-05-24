import { Router } from "express";
import * as rewardController from "../controllers/reward.controller.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/", rewardController.list);
router.get("/redemptions/mine", rewardController.listMyRedemptions);
router.post("/:id/redeem", rewardController.redeem);
router.post("/", requireRole("admin"), rewardController.create);
router.put("/:id", requireRole("admin"), rewardController.update);
router.delete("/:id", requireRole("admin"), rewardController.remove);

export default router;
