import { Router } from "express";
import * as goalController from "../controllers/goal.controller.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/weekly", goalController.weekly);
router.post("/weekly/claim", goalController.claim);

export default router;
