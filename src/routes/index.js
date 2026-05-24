import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import zoneRoutes from "./zone.routes.js";
import taskRoutes from "./task.routes.js";
import rewardRoutes from "./reward.routes.js";
import metricsRoutes from "./metrics.routes.js";
import walletRoutes from "./wallet.routes.js";
import memberRoutes from "./member.routes.js";
import eventRoutes from "./event.routes.js";
import goalRoutes from "./goal.routes.js";
import socialRoutes from "./social.routes.js";

const router = Router();

router.use(healthRoutes);
router.use("/auth", authRoutes);
router.use("/members", memberRoutes);
router.use("/zones", zoneRoutes);
router.use("/tasks", taskRoutes);
router.use("/rewards", rewardRoutes);
router.use("/wallet", walletRoutes);
router.use("/metrics", metricsRoutes);
router.use("/events", eventRoutes);
router.use("/goals", goalRoutes);
router.use("/social", socialRoutes);

export default router;
