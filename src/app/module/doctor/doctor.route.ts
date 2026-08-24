import { Router } from "express";
import { upload } from "../../lib/multer";
import { DoctorController } from "./doctor.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

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

router.post(
    "/approved-doctor",
    auth(Role.ADMIN, Role.SUPER_ADMIN),
    DoctorController.approveDoctor,
);

router.get(
    "/all-doctors",
    auth(Role.ADMIN, Role.SUPER_ADMIN),
    DoctorController.getAllDoctors,
);

export const DoctorRoutes = router;
