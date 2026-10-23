import { Router, type IRouter } from "express";
import healthRouter from "./health";
import navigationRouter from "./navigation";

const router: IRouter = Router();

router.use(healthRouter);
router.use(navigationRouter);

export default router;
