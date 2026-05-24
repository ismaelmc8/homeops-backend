import { Router } from "express";
import * as taskController from "../controllers/task.controller.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/kanban", taskController.listKanban);
router.put("/:id/assignees", requireRole("admin"), taskController.setAssignees);
router.get("/", taskController.list);
router.post("/", requireRole("admin"), taskController.create);
router.put("/:id", requireRole("admin"), taskController.update);
router.delete("/:id", requireRole("admin"), taskController.remove);
router.post("/:id/complete", taskController.complete);

export default router;
