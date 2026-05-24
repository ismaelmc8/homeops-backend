import { Router } from "express";
import * as templateController from "../controllers/template.controller.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware, requireRole("admin"));

router.get("/", templateController.list);
router.post("/", templateController.create);
router.put("/:id", templateController.update);
router.delete("/:id", templateController.remove);
router.post("/:id/apply", templateController.apply);

export default router;
