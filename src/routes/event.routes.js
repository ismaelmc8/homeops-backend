import { Router } from "express";
import * as eventController from "../controllers/event.controller.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/active", eventController.getActive);
router.get("/", requireRole("admin"), eventController.list);
router.post("/", requireRole("admin"), eventController.create);
router.delete("/:id", requireRole("admin"), eventController.remove);

export default router;
