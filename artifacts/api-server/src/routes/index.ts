import { Router, type IRouter } from "express";
import healthRouter from "./health";
import configRouter from "./config";
import authRouter from "./auth";
import discoveryRouter from "./discovery";
import practitionerRouter from "./practitioner";
import appointmentsRouter from "./appointments";
import messagingRouter from "./messaging";
import notificationsRouter from "./notifications";
import reviewsRouter from "./reviews";
import { attachAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);

// Every route below can see the signed-in user when a token is present.
router.use(attachAuth);

router.use(authRouter);
router.use(discoveryRouter);
router.use(practitionerRouter);
router.use(appointmentsRouter);
router.use(messagingRouter);
router.use(notificationsRouter);
router.use(reviewsRouter);

export default router;
