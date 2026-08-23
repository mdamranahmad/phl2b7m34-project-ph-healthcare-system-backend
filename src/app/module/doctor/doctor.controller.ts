import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { DoctorServices } from "./doctor.service";
import { ApplyAsDoctorZSchema } from "./doctor.validation";

const applyAsDoctor = catchAsync(async (req: Request, res: Response) => {
	const files = req.files as { [fieldName: string]: Express.Multer.File[] };

	const resume = files?.["resume"]?.[0];
	const additionalFiles = files?.["additionalFiles"];

	// console.log("req.body.data: ",JSON.parse(req.body.data))

	const zodValidationResult = ApplyAsDoctorZSchema.safeParse(
		JSON.parse(req.body.data),
	);

	if (!zodValidationResult.success) {
		throw new Error(zodValidationResult.error.issues[0].message);
	}

	const payload = zodValidationResult.data;

	const result = await DoctorServices.applyAsDoctor(
		payload,
		resume,
		additionalFiles,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Appllied As Doctor Successfully!",
		data: result,
	});
});

export const DoctorController = {
	applyAsDoctor,
};
