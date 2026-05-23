import { Router } from "express";
import { requireAuth } from "@/app/helpers/jwt";
import * as PaymentController from "../paymentController";

export function paymentRoutes(router: Router) {
  router.get("/user-credits", requireAuth, PaymentController.getUserCredits);
  router.post("/create-setup-session", requireAuth, PaymentController.createSetupSession);
  router.post("/charge-customer", requireAuth, PaymentController.chargeCustomer);
  return router;
}
