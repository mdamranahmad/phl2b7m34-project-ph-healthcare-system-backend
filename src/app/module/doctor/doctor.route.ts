import { Router } from "express";
import { upload } from "../../lib/multer";
import { DoctorController } from "./doctor.controller";

const router = Router();

router.post(
    "/apply-as-doctor",
    // auth(Role.ADMIN, Role.DOCTOR, Role.PATIENT, Role.SUPER_ADMIN),
    upload.fields([
        { name: "resume", maxCount: 1 },
        { name: "additionalFiles", maxCount: 10 },
    ]),
    DoctorController.applyAsDoctor,
);

router.post(
    "/apply-as-doctor/verify-email",
    DoctorController.verifyDoctorEmail,
);
export const DoctorRoutes = router;
