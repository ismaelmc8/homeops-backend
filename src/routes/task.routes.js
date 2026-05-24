import { Router } from "express";
import * as taskController from "../controllers/task.controller.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/kanban", taskController.listKanban);
router.post("/quick-micro", taskController.quickMicro);
router.put("/:id/assignees", requireRole("admin"), taskController.setAssignees);
router.get("/", taskController.list);
router.post("/", requireRole("admin"), taskController.create);
router.put("/:id", requireRole("admin"), taskController.update);
router.delete("/:id", requireRole("admin"), taskController.remove);
router.post("/:id/complete", taskController.complete);
router.post("/:id/postpone", taskController.postpone);
router.post("/:id/split", requireRole("admin"), taskController.split);

export default router;
