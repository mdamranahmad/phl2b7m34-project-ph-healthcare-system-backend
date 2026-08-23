import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
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
export const DoctorRoutes = router;
