import { Router } from "express";
import * as memberController from "../controllers/member.controller.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware, requireRole("admin"));

router.get("/", memberController.list);
router.post("/invite", memberController.invite);
router.post("/:id/resend-invite", memberController.resendInvite);

export default router;
