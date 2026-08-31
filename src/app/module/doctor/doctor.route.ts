import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { DoctorController } from "./doctor.controller";
import { UpdateDoctorProfileZSchema } from "./doctor.validation";

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

router.patch(
	"/update-my-profile",
	auth(Role.DOCTOR),
	validateRequest(UpdateDoctorProfileZSchema),
	DoctorController.updateDoctorProfile,
);

router.get(
	"/doctors-available-today",
	auth(Role.PATIENT),
	DoctorController.getAvailableDoctorsByTodaysSchedule,
);

router.get(
	"/all-doctors-public",
	auth(Role.PATIENT),
	DoctorController.getAllDoctorsListPublic,
);

router.get(
	"/:doctorId",
	auth(Role.PATIENT),
	DoctorController.getSingleDoctorPublicProfile,
);

export const DoctorRoutes = router;
