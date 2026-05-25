import { Router } from "express";
import * as rpgController from "../controllers/rpg.controller.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/profile", rpgController.profile);
router.put("/specialization", rpgController.setSpecialization);
router.put("/title", rpgController.equipTitle);
router.put("/cosmetic", rpgController.equipCosmetic);
router.post("/shop/:key/purchase", rpgController.purchase);
router.post("/revoke-sessions", rpgController.revokeSessions);

export default router;
